/**
 * Tokenizes string into an array of tokens and filters out stopwords.
 * @param name string to get tokenized
 */
function tokenizeAndFilter(name : string) : string[]{
    let tokens : string[] = name.split(' ').join(',').split('.').join(',').split('(').join(',').split(')').join(',').split('-').join(',').split('_').join(',').split(',') // super super awful and nasty, but gets the job done.
    tokens = tokens.filter(function (token){
        if(token){
            if(token.toLowerCase() === "the" || token.toLowerCase() === "of" || token.toLowerCase() === "and" || token === "&" || token === "+"){
                return false
            }else if(token.length <= 1){
                return false
            }else if(token.startsWith("&") && token.indexOf(';') > -1){
                return false
            }else{
                return true
            }
        }else{
            return false
        }
    })
    tokens.forEach((value,index,array) => {array[index] = value.toLowerCase()})
    tokens.forEach((value,index,array) => {array[index] = stemmer(value)})
    return tokens
}

/**
 * 
 * @param url location of the index of documents
 */
async function loadIndexFromURL(url : string) : Promise<Map<string,Object>>{
    let response = await fetch(url)
    let responsetext : string
    if(response.ok){
        responsetext = await response.text()
    }else{
        throw new Error(response.statusText);
    }
    console.debug("parsing index from "+url)
    let parsedResponse : Object[] = JSON.parse(responsetext)
    let parsedIndex : Map<string,Object>
    parsedIndex = new Map()
    for(let object of parsedResponse){
        let id = ""
        let document = new Object()
        for(let property of Object.keys(object)){
            if(property === "id"){
                id = object[property]
            }else{
                document[property] = object[property]
            }
        }
        parsedIndex.set(id,document)
    }
    return parsedIndex
}

/**
 * @returns a Promise that returns an index
 */
function loadInvertedIndexFromURL(url : string) : Promise<Map<string,Array<string>>>{
    return fetch(url).then((response) => {
        if(response.ok){
            return response.text()
        }
        throw new Error("Couldn't fetch shard at URL " + url)
    }).then((response) => {
        let loadedIndex : Map<string,Array<string>> = new Map()
        let lineNumber = 0
        let lines = response.split("\n");
        let version : number
        lines.forEach((line) => {
            if(lineNumber === 0){
                if(parseInt(line) != 1 && parseInt(line) != 2){
                    throw "Error while parsing invinx: Invalid version, must be 1 or 2!"
                }else{
                    version = parseInt(line)
                }
                lineNumber++
                return
            }
            let cols = line.split(",")
            let tokenname = decodeURIComponent(cols[0])
            cols.shift()
            if(version === 2){            
                cols = cols.map(function(value){
                    return value.replace("%2C",",")
                })
            }
            loadedIndex.set(tokenname,cols)
            lineNumber++
        })
        return(loadedIndex)
    })
}

async function getDocumentForId(docid : string) : Promise<Object>{
    docid = docid.replace("%2C",",")
    console.debug("getDocumentForId("+docid+")")
    await inxFetcher.fetchShard(inxFetcher.getIndexFor(docid))
    if(inxFetcher.combinedIndex.get(docid) === undefined){
        console.error("No document found for docid "+docid)
        return {text: "no document found", id: docid}
    }
    let doc = inxFetcher.combinedIndex.get(docid)
    doc["id"] = docid
    return inxFetcher.combinedIndex.get(docid)
}