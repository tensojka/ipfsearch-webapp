var inxFetcher = new IndexFetcher()
var invinxFetcher = new InvertedIndexFetcher()
var meta : metaFormat
var app : any
let ipfsGatewayURL : string
const NUMRESULTS = 30

function onLoad(){
    let params = new URLSearchParams(location.search);
    if(params.get("index")){
        loadMeta(params.get("index")).then(function(){document.getElementById("app").style.visibility = ""})
    }else{
        document.getElementById("app").style.visibility = ""
    }
}

async function loadMeta(metaURL : string) : Promise<void>{
    let response
    if(metaURL.startsWith("/ipfs/") || metaURL.startsWith("/ipns/")){
        response = await fetch((await getIpfsGatewayUrlPrefix()) + metaURL)
    }else{
        response = await fetch(metaURL)
    }
    const json = await response.text()
    try{
        meta = JSON.parse(json)
    }catch(e){
        app.error = "Unable to find index at "+metaURL
        return
    }
    if(meta.invURLBase.startsWith("/ipfs/") || meta.invURLBase.startsWith("/ipns/")){
        meta.invURLBase = (await getIpfsGatewayUrlPrefix()) + meta.invURLBase
    }
    if(meta.inxURLBase.startsWith("/ipfs/") || meta.inxURLBase.startsWith("/ipns/")){
        meta.inxURLBase = (await getIpfsGatewayUrlPrefix()) + meta.inxURLBase
    }

    console.log("meta fetched")
    app.showmeta = false
    app.showsearchbox = true
    app.indexAuthor = meta.author
    app.indexName = meta.name
    let ts = new Date(meta.created)
    app.indexTimestamp = ts.getDate().toString()+"/"+(ts.getMonth()+1).toString()+"/"+ts.getFullYear().toString()
    if(meta.resultPage == undefined){
        //app.resultPage = "basicresultpage/" //default
        app.resultPage = "/basicresultpage"
    }else{
        if(meta.resultPage.startsWith("/ipfs/") || meta.resultPage.startsWith("/ipns/")){
            app.resultPage = (await getIpfsGatewayUrlPrefix()) + meta.resultPage
        }else{
            app.resultPage = meta.resultPage
        }
    }
}

/** 
 * Returns the IPFS gateway. If there is no set, tries to use localhost, otherwise prompts the user to install one on localhost.
 * 
 * If it fails to get one, it aborts the whole page by using document.write and prompting the user to install an IPFS daemon on localhost.
 * 
 * Return format is http://ipfsgateway.tld(:port)
 * note the absence of a trailing slash.
*/
async function getIpfsGatewayUrlPrefix() : Promise<string>{
    if(ipfsGatewayURL !== undefined){
        return ipfsGatewayURL
    }

    if(window.location.protocol === "https:"){
        if(await checkIfIpfsGateway("")){
            ipfsGatewayURL = window.location.protocol+"//"+window.location.host
        }else{
            app.error = "ipfsearch is currently being served from a HTTPS host that is not an IPFS node. This prevents it from using a local IPFS gateway. The node operator should fix this and run an ipfs gateway."
        }
    }else if(await checkIfIpfsGateway("http://localhost:8080")){
        ipfsGatewayURL = "http://localhost:8080"
    }else if(await checkIfIpfsGateway("http://"+window.location.host)){
        ipfsGatewayURL = "http://"+window.location.host
    }else{
        app.error = "Loading of the index requires access to the IPFS network. We have found no running IPFS daemon on localhost. Please install IPFS from <a href='http://ipfs.io/docs/install'>ipfs.io</a> and refresh this page."
        throw new Error("Couldn't get a IPFS gateway.")
    }
    
    return ipfsGatewayURL
}

/**
 * Checks if a given endpoint is a valid IPFS gateway by fetching a "hello world" file over IPFS.
 * @param gatewayURL in format http://ipfsgateway.tld(:port)
 */
async function checkIfIpfsGateway(gatewayURL : string) : Promise<boolean>{
    let response = await fetch(gatewayURL + "/ipfs/QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o")
    if((await response.text()).startsWith("hello world")){ //had to use startsWith bc \n on the end of the file
        return true
    }else{
        return false
    }
}

function searchTriggered(){
    let searchbox = <HTMLInputElement>document.getElementById("searchbox")
    let querytokens = searchbox.value.split(" ")
    querytokens = querytokens.map(querytoken => {
        return stemmer(querytoken)
    });
    console.debug("searching for: "+querytokens.join(" "))
    searchFor(querytokens.join(" "))
}

function searchFor(query : string){
    passProgressToResultpage(0)
    let runningFetches : Array<Promise<void>>= []
    let tokenizedquery = tokenize(query)
    tokenizedquery.forEach((token) => {
        runningFetches.push(invinxFetcher.fetchShard(invinxFetcher.getIndexFor(token)))
    })
    let invToFetch = runningFetches.length
    let invFetched = 0
    runningFetches.forEach((fetch) => {
        fetch.then(() => {
            invFetched++
            passProgressToResultpage(0.5 * invFetched/invToFetch)
        })
    })
    Promise.all(runningFetches).then(() => {
        let candidates = getAllCandidates(tokenizedquery, invinxFetcher.combinedInvIndex)
        console.log("candidates prefilter: "+candidates.size)
        console.debug(candidates)
        candidates = filterCandidates(candidates, tokenizedquery.length)
        console.log("candidates postfilter: "+candidates.size)
        passProgressToResultpage(0.6)
        let resultIds : Array<string>
        resultIds = []
        /**
         * Have we already found the most relevant candidate (=matches all tokens in query)?
         */
        let foundIdealCandidate : boolean
        for(let key of candidates.keys()){
            if(candidates.get(key) == tokenizedquery.length){
                foundIdealCandidate = true
            }
            resultIds.push(key)
        }
        console.debug(candidates)
        if(foundIdealCandidate){
            console.info("Found an ideal candidate in prefetch sorting&filtering. Filtering out all non-ideal candidates...")
            resultIds = resultIds.filter((resultId) => {
                if(candidates.get(resultId) != tokenizedquery.length){
                    return false
                }else{
                    return true
                }
            })
        }else{ //sort them by relevance
            resultIds = resultIds.sort((a,b) => {
                let ascore = candidates.get(a)
                let bscore = candidates.get(b)
                if(ascore > bscore){
                    return -1
                }else if(ascore > bscore){
                    return 1
                }else{
                    return 0
                }
            })
        }
        console.debug("resultIds after prefetch sorting & filtering: ")
        console.debug(resultIds)
        let resultIdsToFetch = resultIds.slice(0, NUMRESULTS)
        passProgressToResultpage(0.7)
        fetchAllDocumentsById(resultIdsToFetch).then((results) => {
            passProgressToResultpage(0.95)
            passResultToResultpage(results)
            //fetch all results, not just the first NUMRESULTS
            resultIds = resultIds.slice(0,1000)
            fetchAllDocumentsById(resultIds).then((results) => {
                passProgressToResultpage(1)
                passResultToResultpage(results)
            })
        })
    })
}

function passResultToResultpage(results : Object[]){
    let resultPageIframe = <HTMLIFrameElement> document.getElementById("resultPage")
    resultPageIframe.contentWindow.postMessage({
        type: "results",
        results: JSON.stringify(results)
    }, '*');
}

/**
 * 
 * @param progress Number between 0 and 1 representing fractional progress made in search.
 */
function passProgressToResultpage(progress : number){
    if(progress > 1){
        throw Error("progress passed to resultpage must be < 1")
    }
    console.log("Progress: "+(progress*100).toString())
    let resultPageIframe = <HTMLIFrameElement> document.getElementById("resultPage")
    resultPageIframe.contentWindow.postMessage({
        type: "progress",
        progress: progress
    }, '*');
}

/**
 * @param ids array of document ids to fetch
 * @returns An array of fetched documents in the same order as ids.
 */
async function fetchAllDocumentsById(ids : string[]) : Promise<Array<Object>> {
    let runningDocumentFetches : Array<Promise<Object>>
    runningDocumentFetches = []
    for (let id in ids) {
        runningDocumentFetches.push(getDocumentForId(ids[id])) ///ooooh order gets messed up? maybeee?
    }
    return Promise.all(runningDocumentFetches).then((results : Array<Object>) => {
        return results
    })
}

/**
 * Filter out candidates that are not relevant enough to fetch.
 * 
 * Example: Say the user has searched for 5 terms. This filters all candidates that match less than 3 of them, if there are some that match all 5.
 * 
 * We are doing this now, before fetching the index (not invinx), to minimize the size of the part of the index that we have to download.
 * 
 * For higher recall, this should not be used.
 */
function filterCandidates(candidates: Map<string, number>, tokensInQuery : number) : Map<string,number>{
    if(tokensInQuery >= 2){
        let filteredCandidates: Map<string, number>
        filteredCandidates = new Map()
        for(let key of candidates.keys()){
            if(candidates.get(key) >= (tokensInQuery/2)){
                filteredCandidates.set(key,candidates.get(key))
            }
        }
        candidates = undefined
        return filteredCandidates
    }else{
        return candidates
    }
}

/**
 * Return all candidates that match at least one token from the query. 
 * Searches only in the part of index that is already downloaded, to it assumes that all required shards are already fetched.
 * @returns a Map, mapping an infohash to the number of times the candidate appeared in the index for given query.
 */
function getAllCandidates(query : Array<string>, index : Map<string, Object>) : Map<string, number> {
    /**
     * Maps the infohash of a candidate to the number of times it appeared in results
     */
    let candidates: Map<string, number>
    candidates = new Map()
    for(let i in query){
        let result = index.get(query[i])
        for(let j in result){
            if(candidates.has(result[j])){
                candidates.set(result[j],candidates.get(result[j])+1) //if candidate already in set, increment the counter of how many times it appeared in the index for the query
            }else{
                candidates.set(result[j], 1)
            }
        }
    }
    return candidates
}

interface metaFormat {
    author:string
    name:string
    created:number
    invURLBase:string
    inxURLBase:string
    inxsplits:string[]
    invsplits:string[]
    resultPage?:string
}