Promise.resolve().then(() => {
  console.log(3)
})
process.nextTick(() =>{
  console.log(1)
  process.nextTick(() =>{
    console.log(2)
  })
})
// 执行顺序是123