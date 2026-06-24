import * as mupdf from 'mupdf'
import * as fs from "node:fs"
import * as geometry_utils from "./geometry_utils.js"
import { Drawing, Path_Metadata, Graph } from './wrappers.js'


const DRAWING_AREA_THRESHOLD = 500 //minimum area a drawing needs to have to be considered


/** Simply extracts a list of Path objects from a Page */
export function get_paths_from_page(page: mupdf.Page): Path_Metadata[]{
    var list = page.toDisplayList()
    var paths : Path_Metadata[] = []
    var traceDevice = new mupdf.Device({ // Object used to extract Path elements
    strokeText(text: any){},
    fillImage(image:any){},
    fillPath (path:mupdf.Path , evenOdd: boolean, ctm: mupdf.Matrix, colorSpace: mupdf.ColorSpace, color: mupdf.Color, alpha: number) {
        var data = new Path_Metadata(path, path.getBounds(null as any, ctm),  ctm, "fill", colorSpace, color, alpha, undefined, evenOdd)
        paths.push(data)
    },
    clipPath (path:mupdf.Path , evenOdd: boolean, ctm: mupdf.Matrix) {
    },
    strokePath (path:mupdf.Path , stroke: mupdf.StrokeState, ctm: mupdf.Matrix, colorSpace: mupdf.ColorSpace, color: mupdf.Color, alpha: number) {
        var data = new Path_Metadata(path, path.getBounds(stroke, ctm),  ctm, "stroke", colorSpace, color, alpha, stroke, undefined)
        paths.push(data)
    },
    clipStrokePath (path: mupdf.Path, stroke: mupdf.StrokeState, ctm: mupdf.Matrix) {
    }
})
    list.run(traceDevice, mupdf.Matrix.identity) 
    return paths;
}


/** Turns a list of Path objects into a clustered list of Drawings, based on overlapping bounding boxes. */
export function group_paths_by_bb(paths: Path_Metadata[]): Drawing[]{
    var drawings: Drawing[] = paths.map(path => new Drawing([path], path.bounds))
    var len_before = drawings.length
    var break_count = 0
    while(true){
        let new_drawings = geometry_utils.merge_bounding_boxes(drawings)
        if (new_drawings.length == len_before)
            break_count += 1
        if (break_count >= 3)
            break
        drawings = new_drawings
        len_before = new_drawings.length
    }
    return drawings.filter((x) => { 
        var res = (x.area() > DRAWING_AREA_THRESHOLD)
        return res
    })
}


/** Exports a drawing to PNG, scaled by a factor of 5 for higher resolution. Filled objects are drawn in red while Stroke objects are drawn in black 
@input name includes the directory (starting in the root of the project) and ends with the desired name of the file. ".PNG" is not required. */
export function export_drawing(drawing: Drawing, name: string){     
    fs.writeFileSync(name+".png", drawing.toPNG())
}


/** Exports a graph as .gv.
@name: includes the directory starting from the root folder of the project up until the desired name of the file, but does not need ".gv" specified.*/
export function exportGraph(graph: Graph, name: string){
    fs.writeFileSync(name+".gv", graph.toString())
}


/** Exports a graph objects as an adjacency list in .txt format.
@name: includes the directory starting from the root folder of the project up until the desired name of the file, but does not need ".txt" specified.*/
export function exportGraphAsAdjacency(graph: Graph, name: string){
    let adjacency = graph.toAdjacencyMatrix()
    let asString : string = ""
    for (const row of adjacency){
        for (const entry of row){
            asString += (entry + " ")
        }
        asString +="\n"
    }
    fs.writeFileSync(name+".txt", asString)
}