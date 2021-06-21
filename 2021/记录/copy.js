import { ActionContext } from 'vuex'
import { last } from 'lodash'
import delay from 'delay'
import { message } from '@tal/vue-component'
import { IState } from '@/types/state'
import { api } from '@/api'
import { queSimilarList } from '@/api/types/question-detail'

import {
  ItemTypeEnum,
  NumberSetEnum,
  MODE,
  paperConfigKey,
  AttrPanelTypeEnum
} from '@/const'
// import { dynamicFavicon } from '@/tools/dynamic-favicon'
import {
  setRepeatQuestion,
  postAddToChild,
  replaceFillContentHtml,
  parseDOM,
  eventReport
} from '@/tools'
import { IPaperDetail, ILayoutSet } from '@/api/types/get-paper-items'
import { PaperItem, PaperItems } from '@/types/item'
import initEditor from '@/tools/init-editor'

type ApiContext = ActionContext<IState, IState>

export default {
  /** 设置paper基础数据 */
  async getPaperItemList({ commit, state, dispatch, getters }: ApiContext) {
    const { paperConfigs: pageVersionConfig } = state
    const {
      paperConfig: {
        settingConfig: { template }
      }
    } = getters

    // 获取元素列表
    const paperDetail = await api.getPaperItems()
    // 初始化编辑器信息
    if (!state.initEditor) {
      await initEditor(paperDetail, commit)
    }
    // 设置二维码初始化数据
    ;[
      { name: 'audio', value: paperDetail.qrAudioCodeExists },
      { name: 'video', value: paperDetail.qrVideoCodeExists }
    ].forEach(({ name, value }: any) => {
      commit('updateMediaQrCodeShowStatus', {
        id: value === 1 ? '.1' : '.2',
        parent: `${name}QrCode`
      })
    })
    // 获取元素列表中试题元素
    const questionIdsList: queSimilarList[] = paperDetail.elementList
      .filter(item => item.contentType === 5 || item.contentType === 4)
      .map((item: any) => ({
        srcQueId: item.initialQueId,
        writtenQueTypeId: item.questionDetails.writtenQuesTypeId,
        logicQueTypeId: item.questionDetails.logicQuesTypeId,
        difficulty: item.questionDetails.difficulty
      }))
    try {
      // 如果是pdf预览页，不需要加载该接口
      if (window.location.href.indexOf('pdf') === -1) {
        await setRepeatQuestion(questionIdsList)
      }
    } catch (e) {
      message.error(e.message || '获取相似题数据失败')
    }
    if (!paperDetail.userInfo) paperDetail.userInfo = {} as any
    const {
      elementList,
      pageVersion,
      paperType,
      userInfo,
      subjectId,
      gradeGroupId,
      groupCode
    } = paperDetail
    const {
      gradeGroupId: userGradeGroupId,
      subjectId: userSubjectId
    } = userInfo
    // realGradeGroupId和realSubjectId设置
    const realGradeGroupId = userGradeGroupId || gradeGroupId || '2'
    const realSubjectId = userSubjectId || subjectId || '2'
    commit('SetDataReportParams', {
      subjectId: realSubjectId,
      gradeGroupId: realGradeGroupId,
      groupCode
    })

    // 年部学科默认初中数学
    if (realGradeGroupId !== userGradeGroupId) {
      userInfo.gradeGroupId = realGradeGroupId
      commit('setChangeSubjectId', true)
    }
    if (realSubjectId !== userSubjectId) {
      userInfo.subjectId = realSubjectId
      commit('setChangeGradeGroupId', true)
    }
    if (realSubjectId !== subjectId) {
      paperDetail.subjectId = realSubjectId
    }
    if (realGradeGroupId !== gradeGroupId) {
      paperDetail.gradeGroupId = realGradeGroupId
    }
    commit('SetPaperInfo', paperDetail)
    const paperConfigs = template.initPaperDefault(pageVersion)
    // TODO:元素列表(挖空填空替换，后面搬出去)
    // 零宽断言参考https://i.linuxtoy.org/docs/guide/ch26s09.html
    // 不能直接在mutation函数外修改VUEX存储状态，这里临时深拷贝处理
    const elementListCopy = JSON.parse(JSON.stringify(elementList))
    // 替换接口返回的挖空题的格式
    replaceFillContentHtml(elementListCopy)

    commit('SetItems', elementListCopy)

    // TODO: 设置备注纠错等map
    commit('SetQuestionErrorMap', elementListCopy)
    // dynamicFavicon()
    // paper 配置
    commit('SetPaperConfig', paperConfigs)
    // 设置用户信息
    commit('SetUserInfo', userInfo)

    // 处理版面设置数据
    const layoutSetStr = paperDetail.layoutSet || JSON.stringify('')
    let layoutSet = JSON.parse(layoutSetStr)
    if (!layoutSet) {
      // 不存在版面设置模块则初始化配置，兼容个人版历史数据
      layoutSet = {
        titleNumber: NumberSetEnum.consecutiveNumber, // 一级标题默认连续编号
        subtitleNumber: NumberSetEnum.groupNumber, // 二级标题默认分组编号
        groupNumber: NumberSetEnum.consecutiveNumber, // 题组默认连续编号
        queNumber: NumberSetEnum.groupNumber // 试题默认分组编号
      }
    }
    // 设置用户信息
    commit('SetLayoutSet', layoutSet)

    const hideLittleQuestionList: any[] = paperDetail.elementList.filter(
      item => item.contentType === 5 || item.contentType === 4
    )
    commit('setHideLittleQuestion', hideLittleQuestionList)
    commit('setInsertAnswerLine')
    commit('getScoreMapData')

    return paperDetail
  },
  /**
   * 添加paper元素
   * TODO: 移动到item.action文件中
   */

  async addPaperItems(
    { commit, state, dispatch }: ApiContext,
    {
      list,
      currentItemId,
      position,
      isDiy,
      originalPaperId,
      paperSysVersion
    }: IImportItemsBatch
  ): Promise<PaperItems> {
    const positionMap: Record<string, 0 | 1> = {
      down: 1,
      up: 0
    }
    const { paperItems, config } = state
    const positionOffest = positionMap[position!] || 0
    let direction: 0 | 1 = 1
    if (position) {
      direction = positionOffest
    } else {
      direction = currentItemId ? positionOffest : 1
    }
    // 元素插入的位置，如果配置了postion,切为down的时候，插入位置需要偏移一位
    const itemInsertPosition = currentItemId
      ? paperItems.findIndex(val => val.id === currentItemId) + positionOffest
      : undefined
    let items: any = null
    if (isDiy) {
      // 新增DIY试题
      const queIdList = list.map(item => item.content)
      items = await api.queryQuestionById({
        queIdList,
        currEleId: currentItemId,
        direction
      })
      items = window.initQrCode.pitchMediaData(items, false)
      setTimeout(() => {
        window.initQrCode.filterElement(items, true)
      })
    } else if (originalPaperId && paperSysVersion) {
      // 历史作业或者教辅
      items = await api.importPaperBatch(
        originalPaperId,
        paperSysVersion,
        list,
        {
          currEleId: currentItemId || undefined,
          direction
        }
      )
      items = window.initQrCode.pitchMediaData(items, false)
      setTimeout(() => {
        window.initQrCode.filterElement(items, true)
      })
    } else {
      items = await api.addPaperItems(list, {
        currEleId: currentItemId || undefined,
        direction
      })
      // 设置新增元素id，处理加号新增元素时，需要自动聚焦的场景，需要在AddItems之前执行 只有添加新的
      commit('SetAddNewId', last(items))
      setTimeout(() => {
        window.initQrCode.filterElement(items, true)
      })
    }
    replaceFillContentHtml(items) // 替换添加item时候的挖空题的content

    commit('AddItems', { items, index: itemInsertPosition })

    // TODO: 设置备注纠错等map
    commit('SetQuestionErrorMap', state.paperItems)

    // 选中元素并进入视图
    const lastItems = last(items)
    dispatch('selectItemAndScroll', lastItems)

    // 修改试题的纠错状态
    commit('UpdateItemIsCorrected', {
      currentPaperItem: null,
      isCorrected: true,
      addFlag: true
    })
    // 半屏通信
    let postMessageInformation: any
    if (state.config.attrPanel.type !== AttrPanelTypeEnum.gradingLine) {
      postMessageInformation = list
    } else {
      const currentContent = (items as any)[0].content
      const currentId = (items as any)[0].id
      const num = state.paperItems.findIndex(
        (cur: any) => cur.content === currentContent && cur.id === currentId
      )
      postMessageInformation = {
        num: num + 1,
        itemId: currentContent
      }
    }
    postAddToChild(postMessageInformation)
    return items || []
  },

  /**
   * 添加paper元素
   * TODO: 移动到item.action文件中
   */

  async putPaperElementFromCar(
    { commit, state, dispatch }: ApiContext,
    params: any
  ): Promise<PaperItems> {
    const positionMap: Record<string, 0 | 1> = {
      down: 1,
      up: 0
    }
    const { paperItems } = state
    const positionOffest = positionMap[params.direction!] || 0
    let direction: 0 | 1 = 1
    if (params.direction) {
      direction = positionOffest
    } else {
      direction = params.currEleId ? positionOffest : 1
    }
    params.direction = direction
    // 元素插入的位置，如果配置了postion,切为down的时候，插入位置需要偏移一位
    const itemInsertPosition = params.currEleId
      ? paperItems.findIndex(val => val.id === params.currEleId) + positionOffest
      : undefined
    const items = await api.putPaperElementFromCar(params)
    // 设置新增元素id，处理加号新增元素时，需要自动聚焦的场景，需要在AddItems之前执行 只有添加新的
    commit('SetAddNewId', last(items))
    setTimeout(() => {
      window.initQrCode.filterElement(items, true)
    })
    replaceFillContentHtml(items) // 替换添加item时候的挖空题的content

    commit('AddItems', { items, index: itemInsertPosition })

    // TODO: 设置备注纠错等map
    commit('SetQuestionErrorMap', state.paperItems)

    // 选中元素并进入视图
    const lastItems = last(items)
    dispatch('selectItemAndScroll', lastItems)

    // 修改试题的纠错状态
    commit('UpdateItemIsCorrected', {
      currentPaperItem: null,
      isCorrected: true,
      addFlag: true
    })
    // 半屏通信(这里不知道通信啥就暂时不处理了)
    const currentContent = (items as any)[0].content
    const currentId = (items as any)[0].id
    const num = state.paperItems.findIndex(
      (cur: any) => cur.content === currentContent && cur.id === currentId
    )
    const postMessageInformation = {
      num: num + 1,
      itemId: currentContent
    }
    postAddToChild(postMessageInformation)
    return items || []
  },

  // ID找题,查题并把题加入到paper中
  async addPaperItemsAddByID(
    { commit, state, dispatch, getters }: ApiContext,
    params: IImportItemsBatchAddByID
  ) {
    const currEleId = state.currentItemId
    const direction = 1 // 向下插入数据（没有向上的场景，暂时保留配置）
    const param = { currEleId, direction, ...params }
    const items = await api.addQuestionBatch(param)
    // 设置新增元素id，处理加号新增元素时，需要自动聚焦的场景，需要在AddItems之前执行 只有添加新的
    if (items && items.length) {
      // 让id找题的弹窗消失
      commit('ChangeAddIDModal', false)
      commit('SetAddNewId', last(items))
      setTimeout(() => {
        window.initQrCode.filterElement(items, true)
      })
      replaceFillContentHtml(items)
      const itemInsertPosition = currEleId
        ? state.paperItems.findIndex(val => val.id === currEleId) + 1
        : undefined
      commit('AddItems', { items, index: itemInsertPosition })
      // TODO: 设置备注纠错等map
      commit('SetQuestionErrorMap', state.paperItems)
      const lastItems = last(items)
      // 选中元素并进入视图
      dispatch('selectItemAndScroll', lastItems)
      message.success(`成功加入${items.length}个资源`)
      eventReport.clickIDAddQuestionSureReport({
        queAddState: 1
      })
      // 修改试题的纠错状态
      commit('UpdateItemIsCorrected', {
        currentPaperItem: null,
        isCorrected: true,
        addFlag: true
      })
      await delay(100)
      const lastItemID = (lastItems as any).id
      commit('SetCurrentIndex', getters.virtualListItemIndexMap[lastItemID])
      dispatch('setItemsSelectHighlight', { value: lastItemID })
    }
  },

  /**
   * 获取pdf可用下载次数信息
   */
  async getDownloadTimeInfo({ commit }: ApiContext) {
    const downloadTimeInfo = await api.getAvailableCount()
    commit('SetDownloadTimesInfo', downloadTimeInfo)
  },
  /**
   * 获取配置后台数据
   */
  async getPaperBaseConfig({ commit }: ApiContext) {
    // 获取配置后台配置
    commit('SetPaperBaseConfig', await api.getPaperConfig())
  },

  /**
   * 设置编号
   */
  async SetLayoutSet(
    { commit, dispatch, getters }: any,
    { layoutSet }: { layoutSet: ILayoutSet }
  ) {
    // 获取元素列表
    await api.modifyLayoutSet({ layoutSet: JSON.stringify(layoutSet) })
    // 设置用户信息
    commit('SetLayoutSet', layoutSet)
  }
}

// 添加元素参数
/** 这里跟paper-item.action重复，可合并 */
interface IAddItemsParams {
  list: { contentType: ItemTypeEnum; content: string }[]
  currentItemId: null | string
  position?: 'down' | 'up'
  isDiy?: boolean
}

interface IImportItemsBatch extends IAddItemsParams {
  originalPaperId?: any
  paperSysVersion?: any
}

interface IImportItemsBatchAddByID {
  queIdList: string[]
  confirmAdd?: boolean
}

export declare namespace ApiAction {
  /** 获取paper基础数据 */
  type getPaperBaseConfig = () => Promise<void>
  /** 获取paper基础数据 */
  type getPaperItemList = () => Promise<IPaperDetail>
  /** 添加元素列表 */
  type addPaperItems = (params: IImportItemsBatch) => Promise<PaperItems>
  /** 资源车添加元素列表 */
  type putPaperElementFromCar = (
    params: IImportItemsBatch
  ) => Promise<PaperItems>
  /** 获取pdf可用下载数 */
  type getDownloadTimeInfo = () => Promise<void>
  /** 设置编号 */
  type SetLayoutSet = (params: { layoutSet: ILayoutSet }) => Promise<void>
}
