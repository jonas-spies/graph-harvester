import { error } from "node:console"
import { Drawing, Path_Metadata } from "./wrappers.js"
import RBush from "rbush"
import * as fs from "node:fs"


export function merge_bounding_boxes(drawings: Drawing[]){
    const tree = new RBush<Drawing>()
    var result : Drawing[] = []
    var already_used: Map<Drawing, number> = new Map
    tree.load(drawings)
    for (var drawing of drawings){ 
        //For each drawing, check for intersections, only taking drawings not yet used
        let neighbors = tree.search(drawing).filter((x) => !already_used.has(x) && x !== drawing)
        //Get index of cluster drawing belongs to
        var index = already_used.get(drawing)
        if (index === undefined){
            index = result.length
            result.push(drawing)
            already_used.set(drawing, index)
        }
        //Add neighbors to corresponding cluster   
        if (neighbors.length > 0){
            for (var n of neighbors){
                var cluster = result[index]
                if(cluster === undefined)
                    throw error("Error: cluster with index"+index+"is out of bounds")
                let merged = Drawing.merge(cluster, n)
                result[index] = merged
                already_used.set(n, index)
            }
        }
    }
    //fs.appendFileSync("test_files/log.txt", "Found "+result.length+" groups: \n"+result.toString() + "\n")
    return result
}
