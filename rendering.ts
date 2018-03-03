class AppState {
    results : Object[]
}

var toRender = new AppState()

/**
 * Renders contents of the toRender on into the #appcontainer
 */
function render(appState? : AppState) : void {
    if(appState === undefined){
        appState = toRender
    }
    //work with it further, render all of it man!
    
    let appcontainer = window.document.getElementById("appcontainer")
    let html : string


    //render search results if there're any
    if(appState.results.length === 0){
        console.log("no results :(")
    }else if(typeof(appState.results) == typeof([])){
        html = "<table class='results'><tr>"
        for(let prop of Object.keys(appState.results[0])){
            html += "<th>"+prop+"</th>"
        }
        html += "</tr>"

        for(let result of appState.results){
            html += "<tr>"
            if(typeof(result) !== "object") continue
            for(let prop of Object.keys(result)){
                html += "<td>"+result[prop]+"</td>"
            }
            html += "</tr>"
        }

        html += "</table>"
    }

    //send to browser. yes, building source html might be a little slow, but it's easy&simple
    appcontainer.innerHTML = html
    return
}