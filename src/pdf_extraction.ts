import * as mupdf from 'mupdf'
import * as fs from "node:fs"
import * as geometry_utils from "./geometry_utils.js"
import { Drawing, Path_Metadata } from './wrappers.js'


const DRAWING_AREA_THRESHOLD = 500 //minimum area a drawing needs to have to be considered


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
        if (!res){
          // fs.appendFileSync("test_files/log.txt", "Filtering "+x.toString() + "?: "+ "\n")
        }
        return res
    })
}


export function export_drawing(drawing: Drawing, name: string){     
    /** Exports a drawing as PNG for debugging purposes*/
    let boundingbox = drawing.getBounds()
    const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, boundingbox, false)
    pixmap.clear(255)
    let drawDevice = new mupdf.DrawDevice(mupdf.Matrix.identity, pixmap)
    
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
    fs.writeFileSync("test_files/"+name+".png", pixmap.asPNG())
}

