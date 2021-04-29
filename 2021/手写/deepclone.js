let map = new WeakMap()
function jsType(target){
  return Object.prototype.toString.call(target).slice(8, -1).toLowerCase()
}
function deepClone(obj){
  if(obj instanceof Object){
    if(map.has(obj)){
      return map.get(obj)
    }
    let newObj = null
    if(obj instanceof Array){
      newObj = []
    }else if(obj instanceof Date){
      newObj = new Date(obj)
    }else if(obj instanceof RegExp){
      newObj = new RegExp(obj.source, obj.flags)
    }else if(obj instanceof Function){
      newObj = function(){
        return obj.apply(this,arguments)
      }
    }else{
      newObj = {}
    }
    let desc = Object.getOwnPropertyDescriptor(obj)
    let clone = Object.create(Object.getPrototypeOf(obj),desc)
    map.set(obj, clone)
  }
  return obj
}

function deepClone1(target){
  let result
  if(target instanceof Object){
    if(target instanceof Function){
      result = function(){
        target.apply(this, arguments)
      }
    }else if(target instanceof RegExp){
      result = new RegExp(target)
    }else if(target instanceof Array){
      result = []
      for(let item of target){
        result.push(deepClone1(item))
      }
    }else if(target instanceof Date){
      result = new Date(target)
    }else{
      result = {}
      for(let key in target){
        result[key] = deepClone1(target[key])
      }
    }
  }else{
    result = target
  }
  return result
}