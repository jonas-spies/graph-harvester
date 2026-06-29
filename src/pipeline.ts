import * as mupdf from 'mupdf'
import * as fs from "node:fs"
import {detect_graphs_from_drawing} from "./graph_detection.js"
import * as pdf_extraction from "./pdf_extraction.js"
import { Graph, type DetectedGraph } from './wrappers.js'


export function execute(){
    var logs: string[] = ["Logs of the most recent iteration\n"]
    let doc = mupdf.PDFDocument.openDocument(fs.readFileSync("test_files/test.pdf"))
    var graphs: Graph[] = []
    for  (var i = 0; i< doc.countPages(); i++){
        var page = doc.loadPage(i)
        let paths = pdf_extraction.get_paths_from_page(page)
        let drawings = pdf_extraction.group_paths_by_bb(paths).sort((a,b) => a.minX - b.minX)
        //console.log("number of drawings: "+drawings.length)
        for (var j =0; j<drawings.length; j++){
            var drawing = drawings[j]
            if (drawing !== undefined){
                pdf_extraction.export_drawing(drawing, "test_files/test_d"+(j+1))
                let new_graphs = detect_graphs_from_drawing(drawing, logs)
                for (var k = 0; k<new_graphs.length; k++){
                    new_graphs[k]!.metadata.push("Page " +(i+1) + ", Drawing " + (j+1) + ", Nr " + k)
                    pdf_extraction.exportGraph(new_graphs[k]!, "test_files/Drawing " + (j+1) + ", Nr " + k)
                }
                graphs.push(...new_graphs)
            }      
        }
    }
    fs.writeFileSync("test_files/log.txt", logs.join(""))
    return graphs
}


export function execute_file(file: string | ArrayBuffer | mupdf.Buffer | Uint8Array<ArrayBufferLike> | mupdf.Stream, params:{hog: boolean, logs?: string[], to_png? :string}){
    let doc = mupdf.PDFDocument.openDocument(file)
    let detected_graphs: DetectedGraph[] = []
    for  (var i = 0; i< doc.countPages(); i++){
        var page = doc.loadPage(i)
        let paths = pdf_extraction.get_paths_from_page(page)
        let drawings = pdf_extraction.group_paths_by_bb(paths).sort((a,b) => a.minX - b.minX)
        for (var j =0; j<drawings.length; j++){
            var drawing = drawings[j]
            if (drawing !== undefined){
                let new_graphs = detect_graphs_from_drawing(drawing, params?.logs)
                if(params?.to_png){
                    pdf_extraction.export_drawing(drawing, params?.to_png+"p"+(i+1)+"d"+(j+1))
                }
                for (var k = 0; k<new_graphs.length; k++){
                    new_graphs[k]!.metadata.push("Page " +(i+1) + ", Drawing " + (j+1) + ", Nr " + k)
                }
                detected_graphs.push(Graph.toDetectedGraph(new_graphs, drawing, params.hog))
            }      
        }
    }
    return detected_graphs
}
