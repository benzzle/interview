<template>
  <div
    v-if="showEl"
    class="farm-entry-con"
    @touchstart.stop="touchstart"
    @touchmove.stop.prevent="touchmove"
    @touchend.stop="touchend"
    @click="goLink"
    :style="`left: ${showX}px; top: ${showY}px;`"
    :class="{transition: showAni}"
  >
    <img src="https://store.sdbao.com/renewal/farm/tree_6_3.png">
  </div>
</template>

<script>
import { throttle } from '@/common/utils/filter/index'

export default {
  props: {
    safeTop: {
      type: Number,
      default: 100
    },
    safeBottom: {
      type: Number,
      default: 100
    },
    initTop: {
      type: Number,
      default: 0.6
    }
  },
  data() {
    return {
      showEl: false,
      // 元素大小
      elSize: {
        width: 0,
        height: 0
      },
      // 屏幕大小
      screenSize: {
        width: 0,
        height: 0
      },
      // 最终的值
      showX: 0,
      showY: 0,
      // 锚点值
      anchorX: 0,
      anchorY: 0,
      // 开始移动的值
      startX: 0,
      startY: 0,
      // 添加动画
      showAni: false
    }
  },
  created() {
    this.getData()
  },
  methods: {
    // 获取数据，是否显示入口
    async getData() {
      // apollo开关
      try {
        const { data } = await this.$api.getGrowApolloConfig({
          key: 'rew_farm_switch'
        })

        if (!data || `${data}` !== 'true') {
          return
        }
      } catch (err) {
        console.error(err)
      }

      try {
        const { data } = await this.$api.getFarmEntry()

        this.showEl = !!data
      } catch (error) {
        this.$sentryLog(error)
      }

      // 显示了dom？
      if (this.showEl) {
        await this.$nextTick()

        this.initSize()
      }
    },
    // 初始化位置
    initSize() {
      const elPosition = this.$el.getBoundingClientRect()

      // 元素大小
      const elSize = {
        width: parseInt(elPosition.width),
        height: parseInt(elPosition.height)
      }
      // 屏幕大小
      const screenSize = {
        width: parseInt(window.innerWidth),
        height: parseInt(window.innerHeight)
      }

      // 初始化靠右
      this.showX = parseInt(screenSize.width - elSize.width)
      // 高度 60%
      this.showY = parseInt(screenSize.height * this.initTop)

      this.elSize = elSize
      this.screenSize = screenSize
    },
    // 开始移动
    touchstart($event) {
      // 动画中，不移动
      if (this.showAni) {
        return
      }
      const touch = $event.touches[0]
      const elPosition = this.$el.getBoundingClientRect()

      // 记录鼠标的位置
      this.startX = touch.clientX
      this.startY = touch.clientY

      // 标记锚点
      this.anchorX = elPosition.x
      this.anchorY = elPosition.y
    },
    // 移动中
    touchmove: throttle(function($event) {
      // 动画中，不移动
      if (this.showAni) {
        return
      }
      const touch = $event.touches[0]

      // 计算偏移量
      const x = parseInt(touch.clientX - this.startX)
      const y = parseInt(touch.clientY - this.startY)

      // 设置位置
      this.showX = this.anchorX + x
      this.showY = this.anchorY + y
    }),
    // 触摸结束
    touchend() {
      // 动画中，不移动
      if (this.showAni) {
        return
      }

      this.correctPosition()
    },
    // 修正位置
    async correctPosition() {
      // 上下百分之100像素的安全区
      const safeTop = this.safeTop
      // 下方安全区域
      const safeBottom = this.screenSize.height - this.elSize.height - this.safeBottom
      // 左侧安全区域
      const safeLeft = 0
      // 右侧安全区域
      const safeRight = this.screenSize.width - this.elSize.width
      let x = 0
      let y = this.showY

      // 强制滑块靠边，类似苹果小球，x轴偏右边
      if (this.showX > (this.screenSize.width / 2) - (this.elSize.width / 2)) {
        x = safeRight
      } else { // 偏左边
        x = safeLeft
      }

      // y轴是否超越上方安全局
      if (y < safeTop) {
        y = safeTop
      }

      // 是否超越下方安全区域
      if (y > safeBottom) {
        y = safeBottom
      }

      // 添加过渡动画
      this.showAni = true

      await this.$nextTick()

      // 修正位置
      this.showX = x
      this.showY = y

      // 删除过渡动画
      setTimeout(() => {
        this.showAni = false
      }, 300)
    },
    goLink() {
      this.$navigate.redirectTo({
        path: `/rew/farm`
      })
    }
  }
}
</script>

<style lang="less" scoped>
.farm-entry-con {
  position: fixed;
  width: 100px;
  height: 100px;

  > img {
    width: 100%;
  }
}

.transition {
  transition: all 0.3s;
}
</style>
