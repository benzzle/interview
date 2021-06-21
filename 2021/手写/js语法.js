​​​​function f() {return '111'}
function test(x) {
  var result = []
  console.log(typeof f)
  if (x) {
    function f() {return '222'}
    result.push(f())
  }
  result.push(f())
  return result
}
console.log(test(1))