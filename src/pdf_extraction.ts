import * as mupdf from 'mupdf'
import * as fs from "node:fs"
import * as geometry_utils from "./geometry_utils.js"
import { Drawing, Path_Metadata } from './wrappers.js'

const drawing_area_threshold = 500 //minimum area a drawing needs to have to be considered

var pathPrinter = {
    moveTo: function (x: number, y: number) { fs.appendFileSync("test_files/log.txt", "moveTo "+ x + " "+ y + "\n") },
    lineTo: function (x: number, y: number) { fs.appendFileSync("test_files/log.txt", "lineTo "+ x + " " + y + "\n") },
    curveTo: function (x1:number, y1:number, x2:number, y2:number, x3:number, y3:number) { fs.appendFileSync("test_files/log.txt", "curveTo" + x1 +" "+ y1 +" "+ x2 +" "+ y2 + " "+  x3 + " "+  y3 + "\n") },
    closePath: function () { fs.appendFileSync("test_files/log.txt", "closePath\n") }
}   

function get_paths_from_page(page: mupdf.Page): Path_Metadata[]{
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

function group_paths_by_bb(paths: Path_Metadata[]): Drawing[]{
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
        var res = (x.area() > drawing_area_threshold)
        if (!res){
          fs.appendFileSync("test_files/log.txt", "Filtering "+x.toString() + "?: "+ "\n")  
        }
        return res
    })
}

function export_drawing(drawing: Drawing, name: string){     
    /** Exports a drawing as PNG */
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

function main(){
    fs.writeFileSync("test_files/log.txt", "Logs of the most recent iteration\n")
    let doc = mupdf.PDFDocument.openDocument(fs.readFileSync("test_files/test1.pdf"))
    for  (var i = 0; i< doc.countPages(); i++){
        var page = doc.loadPage(i)
        let paths = get_paths_from_page(page)
        let drawings = group_paths_by_bb(paths)
        fs.appendFileSync("test_files/log.txt", "\nEnded with following grouping: \n"+drawings.toString()+"\n")
        for (var j =0; j<drawings.length; j++){
            var png = drawings[j]
            if (png !== undefined)
                export_drawing(png, "page"+i+"_nr"+j)
        }
    }
}


main();

