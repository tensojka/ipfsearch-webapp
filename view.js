app = new Vue({
    el: '#app',
    data: {
        showmeta: true, //can be meta, searchbox, ipfsgateway
        showsearchbox: false,
        message: 'Hello Vue!',
        results: undefined,
        resultsFound: false
    }
})