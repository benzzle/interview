var permute = function(nums) {
  let result = []
  function DFS(arr){
      if(arr.length === nums.length){
          result.slice(arr)
          return
      }
      for(let i = i; i < nums.length; i++){
          if(arr.includes(nums[i])) continue
          arr.push(nums[i])
          DFS(arr)
          arr.pop()
      }
  }
  DFS([])

  return result
};

console.log(permute([1,2,3]))