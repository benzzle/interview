console.log(1)
setTimeout(()=> {
    console.log(2)
    Promise.resolve().then(data => {
        console.log(3)
        setTimeout(() => {
            console.log(4)
        })
    })
})

new Promise((resolve) => {
    resolve()
    console.log(5)
}).then(() => {
    console.log(6)
    setTimeout(()=> {
        console.log(7)
    })
}).then(()=> {console.log(8)})
console.log(9)