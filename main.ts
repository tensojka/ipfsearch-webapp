var inxFetcher = new IndexFetcher()
var invinxFetcher = new InvertedIndexFetcher()
var meta : metaFormat

async function loadMeta(metaURL){
    const response = await fetch(metaURL) //Isn't this LOVELY?
    const json = await response.text()
    meta = JSON.parse(json)
    console.log("meta successfully fetched.")
}
function loadMetaFromButton(){
    let metainputbox = <HTMLInputElement>document.getElementById("meta")
    loadMeta(metainputbox.value)
}

function searchTriggered(){
    let searchbox = <HTMLInputElement>document.getElementById("searchbox")
    searchFor(searchbox.value)
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
        let candidates = getAllCandidates(tokenizedquery, invinxFetcher.combinedIndex)
        var tCandidatesGenerated = performance.now();
        console.log("Candidate generation took " + Math.round(tCandidatesGenerated - tFetchEnd) + " ms.")
        console.log("candidates prefilter: "+candidates.size)
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
            toRender.results = results
            render(toRender)
        })
    })
}

/**
 * Filter out candidates that are not relevant enough.
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
            if(candidates.get(key) > 1){
                filteredCandidates.set(key,candidates.get(key))
            }
        }
        candidates = undefined
        return filteredCandidates
    }else{
        return candidates
    }
    //TODO
}

/**
 * Return all candidates that match at least one token from the query. 
 * Searches only in the part of index that is already downloaded, to it assumes that all required shards are already fetched.
 * @returns a Map, mapping an infohash to the number of times the candidate appeared in the index for given query.
 */
function getAllCandidates(query : Array<string>, index : Map<string, Object>) : Map<string, number> {
    let candidates: Map<string, number> //maps the infohash of a candidate to the number of times it appeared in results
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