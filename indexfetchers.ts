class IndexFetcher {
    combinedIndex: Map<string, Object> = new Map()
    shardMap : [string]
    /**
     * key is shardid, value is true if the shard has been fetched and incorporated into the index var
     */
    shardsFetched : Map<number,boolean> = new Map()

    /**
     * Fetch shard and incorporate it into the index.
     */
    async fetchShard(shardid: number) : Promise<void>{
        if(this.shardsFetched.has(shardid)){
            console.debug("not needing to fetch shard "+shardid)
            return
        }
        console.debug("started fetching inx shard " + shardid)
        this.shardsFetched.set(shardid, false)
        let shard = await loadIndexFromURL(meta.inxURLBase + shardid.toString())    
        for(let i of shard.keys()){
            if(!inxFetcher.combinedIndex.has(i)){
                inxFetcher.combinedIndex.set(i, shard.get(i))
            }else{
                //console.debug("this is weird, we fetched a token twice.")
                //This is not weird if you're on firefox, bc there, the first key of a set is always an empty string.
                if(i != ""){
                    console.warn("srsly weird")
                }
            }
        }
        console.debug("shard " + shardid + " fetched!")
        inxFetcher.shardsFetched.set(shardid, true)
    }

    /**
     * Gets shardid that contains a given token/docid. Needs to have partMap fetched.
     * @param token 
     * @return shardid
     */
    getIndexFor(token : string) : number{
        let needle = 0
        while(meta.inxsplits[needle] < token){
            needle++
        }
        if(needle !== 0){
            return needle-1
        }else return needle
    }
}

class InvertedIndexFetcher extends IndexFetcher {
    /**
     * Fetch shard and incorporate it into the index.
     */
    async fetchShard(shardid: number) : Promise<void>{
        if(this.shardsFetched.has(shardid)){
            return
        }
        console.debug("started fetching invinx shard " + shardid)
        this.shardsFetched.set(shardid, false)
        let shard = await loadInvertedIndexFromURL(meta.invURLBase + shardid.toString())      
        for(let i of shard.keys()){
            if(!invinxFetcher.combinedIndex.has(i)){
                invinxFetcher.combinedIndex.set(i, shard.get(i))
            }else{
                //console.debug("this is weird, we fetched a token twice.")
                //This is not weird if you're on firefox, bc there, the first key of a set is always an empty string.
                if(i != ""){
                    console.warn("srsly weird")
                }
            }
        }
        console.debug("invinx shard " + shardid + " fetched!")
        invinxFetcher.shardsFetched.set(shardid, true)
    }

    /**
     * Gets shardid that contains a given token/docid. Needs to have partMap fetched.
     * @param token 
     * @return shardid
     */
    getIndexFor(token : string) : number{
        let needle = 0
        while(meta.invsplits[needle] < token){
            needle++
        }
        if(needle !== 0){
            return needle-1
        }else return needle
    }
}