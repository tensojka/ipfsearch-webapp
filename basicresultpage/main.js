app = new Vue({
    el: '#app',
    data: {
        results: undefined,
        resultsFound: false
    }
})

window.onmessage = function(e){
    if (e.data.type == "results") {
        app.results = JSON.parse(e.data.results)
        app.resultsFound = true
        setTimeout(updateSize,1)
    }
};

function updateSize(){
    window.parent.postMessage(parseInt(document.body.scrollHeight),"*")
}