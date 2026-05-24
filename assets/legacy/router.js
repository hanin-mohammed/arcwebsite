document
.querySelectorAll(".tab")
.forEach(
t=>{

t.onclick=
()=>{

document
.querySelectorAll(".tab")
.forEach(
x=>
x.classList.remove(
"active"
)
)

t.classList.add(
"active"
)

}

}
)
