var inxFetcher = new IndexFetcher()
var invinxFetcher = new InvertedIndexFetcher()
var meta : metaFormat
var app : any
let ipfsGatewayURL : string

function onLoad(){
    
    let params = new URLSearchParams(location.search);
    if(params.get("index")){
        console.log(params.get("index"))
        loadMeta(params.get("index")).then(function(){document.getElementById("app").style.visibility = ""})
    }else{
        document.getElementById("app").style.visibility = ""
    }
}

async function loadMeta(metaURL : string){
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

    console.log("meta successfully fetched.")
    app.showmeta = false
    app.showsearchbox = true
    app.indexAuthor = meta.author
    app.indexName = meta.name
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
    var tStart = performance.now();
    let runningFetches : Array<Promise<void>>= []
    let tokenizedquery = tokenizeAndFilter(query)
    tokenizedquery.forEach((token) => {
        runningFetches.push(invinxFetcher.fetchShard(invinxFetcher.getIndexFor(token)))
    })
    Promise.all(runningFetches).then(() => {
        var tFetchEnd = performance.now();
        console.log("Fetching new shards for this query took " + Math.round(tFetchEnd - tStart) + " ms.")
        let candidates = getAllCandidates(tokenizedquery, invinxFetcher.combinedInvIndex)
        var tCandidatesGenerated = performance.now();
        console.log("Candidate generation took " + Math.round(tCandidatesGenerated - tFetchEnd) + " ms.")
        console.log("candidates prefilter: "+candidates.size)
        console.debug(candidates)
        candidates = filterCandidates(candidates, tokenizedquery.length)
        console.log("candidates postfilter: "+candidates.size)
        let resultIds : Array<string>
        resultIds = []
        for(let key of candidates.keys()){
            resultIds.push(key)
        }
        console.debug(candidates)
        console.debug(resultIds)
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
        console.debug(resultIds)
        resultIds = resultIds.slice(0, 30)
        let runningDocumentFetches : Array<Promise<Object>>
        runningDocumentFetches = []
        for (let i in resultIds) {
            runningDocumentFetches.push(getDocumentForId(resultIds[i])) ///ooooh order gets messed up? maybeee?
        }
        let tDocFetchStart = performance.now()
        console.log("Result generation (&misc) took " + Math.round(tDocFetchStart - tCandidatesGenerated) + " ms.")
        Promise.all(runningDocumentFetches).then((results : Array<Object>) => {
            let tDocFetchEnd = performance.now()
            console.log("Index fetching and parsing and final result generation took " + Math.round(tDocFetchEnd - tDocFetchStart) + " ms.")
            app.resultsFound = true
            app.results = results
        })
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
}