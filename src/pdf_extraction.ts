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
        var data = new Path_Metadata(path, path.getBounds(null as any, ctm),  ctm, "fill")
        paths.push(data)
    },
    clipPath (path:mupdf.Path , evenOdd: boolean, ctm: mupdf.Matrix) {
    },
    strokePath (path:mupdf.Path , stroke: mupdf.StrokeState, ctm: mupdf.Matrix, colorSpace: mupdf.ColorSpace, color: mupdf.Color, alpha: number) {
        var data = new Path_Metadata(path, path.getBounds(stroke, ctm),  ctm, "stroke", stroke)
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
    /** Exports a drawing as PNG for debugging purposes*/
    const scale = 5
    const matrix = mupdf.Matrix.scale(scale,scale)
    let boundingbox = drawing.getBounds()
    let {x: x1,y: y1} = geometry_utils.transform_point(matrix, boundingbox[0], boundingbox[1])
    boundingbox[0] = x1
    boundingbox[1] = y1
    let {x: x2,y: y2} = geometry_utils.transform_point(matrix, boundingbox[2], boundingbox[3])
    boundingbox[2] = x2
    boundingbox[3] = y2
    const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, boundingbox, false)
    pixmap.clear(255)
    let drawDevice = new mupdf.DrawDevice(matrix, pixmap)
    
    for (var path of drawing.paths){
        switch (path.type){
            case "fill":
                drawDevice.fillPath(path.path, true, path.ctm, mupdf.ColorSpace.DeviceRGB, [1,0,0], 1)
                continue
            case "stroke":
                let stroke = path.stroke? path.stroke : new mupdf.StrokeState({
                lineCap: "Square",
                lineJoin: "Bevel",
                lineWidth: 2.0,
                miterLimit: 1.414,
                dashPhase: 11
                })
                drawDevice.strokePath(path.path, stroke ,path.ctm,mupdf.ColorSpace.DeviceRGB, [0,0,0], 1)
        }
    }
    fs.writeFileSync(name+".png", pixmap.asPNG())
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