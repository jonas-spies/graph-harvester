import * as mupdf from 'mupdf'
import * as fs from "node:fs"
import {detect_graphs_from_drawing} from "./graph_detection.js"
import * as pdf_extraction from "./pdf_extraction.js"
import { Graph } from './wrappers.js'


export function execute(){
    var logs: string[] = ["Logs of the most recent iteration\n"]
    let doc = mupdf.PDFDocument.openDocument(fs.readFileSync("test_files/test2.pdf"))
    var graphs: Graph[] = []
    for  (var i = 0; i< doc.countPages(); i++){
        var page = doc.loadPage(i)
        let paths = pdf_extraction.get_paths_from_page(page)
        let drawings = pdf_extraction.group_paths_by_bb(paths)
        for (var j =0; j<drawings.length; j++){
            var drawing = drawings[j]
            if (drawing !== undefined){
                let new_graphs = detect_graphs_from_drawing(drawing, logs)
                graphs.concat(new_graphs)
            }      
        }
    }
    fs.writeFileSync("test_files/log.txt", logs.join(""))
    return graphs
}


export function execute_file(file: string | ArrayBuffer | mupdf.Buffer | Uint8Array<ArrayBufferLike> | mupdf.Stream, logs?: string[], to_png? :string){
    let doc = mupdf.PDFDocument.openDocument(file)
    var graphs: Graph[] = []
    for  (var i = 0; i< doc.countPages(); i++){
        var page = doc.loadPage(i)
        let paths = pdf_extraction.get_paths_from_page(page)
        let drawings = pdf_extraction.group_paths_by_bb(paths)
        for (var j =0; j<drawings.length; j++){
            var drawing = drawings[j]
            if (drawing !== undefined){
                let new_graphs = detect_graphs_from_drawing(drawing, logs)
                if(to_png && new_graphs.length > 0){
                    pdf_extraction.export_drawing(drawing, to_png+"p"+(i+1)+"d"+(j+1))
                }
                for (var k = 0; k<new_graphs.length; k++){
                    new_graphs[k]!.metadata.push("Page " +(i+1) + ", Drawing " + (j+1) + ", Nr " + k)
                }
                graphs = graphs.concat(new_graphs)
            }      
        }
    }
    return graphs
}
