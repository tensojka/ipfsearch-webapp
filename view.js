app = new Vue({
    el: '#app',
    data: {
        showmeta: true,
        showsearchbox: false,
        error : "",
        resultPage: ""
    }
})

window.addEventListener('message',function(e) {
    if(typeof e.data == "number"){
        this.document.getElementsByTagName("iframe")[0].style.height = e.data + 32
    }
},false);