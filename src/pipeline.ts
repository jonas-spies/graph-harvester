import * as mupdf from 'mupdf'
import * as fs from "node:fs"
import {detect_graph_from_drawing} from "./graph_detection.js"
import * as pdf_extraction from "./pdf_extraction.js"


export function execute(){
    var logs: string[] = ["test_files/log.txt", "Logs of the most recent iteration\n"]
    let doc = mupdf.PDFDocument.openDocument(fs.readFileSync("test_files/test1.pdf"))
    for  (var i = 0; i< doc.countPages(); i++){
        var page = doc.loadPage(i)
        let paths = pdf_extraction.get_paths_from_page(page)
        let drawings = pdf_extraction.group_paths_by_bb(paths)
        logs.push("\nEnded with following grouping: \n"+drawings.toString()+"\n")
        for (var j =0; j<drawings.length; j++){
            var drawing = drawings[j]
            if (drawing !== undefined){
                logs.push("\nPage " +i + " Drawing Nr. " + j + "\n")
                
                pdf_extraction.export_drawing(drawing, "page"+i+"_nr"+j) // debugging purposes
                detect_graph_from_drawing(drawing)
            }
                
        }
    }
    fs.writeFileSync("test_files/log.txt", logs.join(" "))
}


export function execute_file(file: ArrayBuffer){
    let doc = mupdf.PDFDocument.openDocument(file)
    for  (var i = 0; i< doc.countPages(); i++){
        var page = doc.loadPage(i)
        let paths = pdf_extraction.get_paths_from_page(page)
        let drawings = pdf_extraction.group_paths_by_bb(paths)
        for (const drawing of drawings){
            detect_graph_from_drawing(drawing)
        }
    }
}
