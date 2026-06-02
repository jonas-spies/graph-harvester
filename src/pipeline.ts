import * as mupdf from 'mupdf'
import * as fs from "node:fs"
import {detect_graph_from_drawing} from "./graph_detection.js"
import * as pdf_extraction from "./pdf_extraction.js"


function execute(){
    fs.writeFileSync("test_files/log.txt", "Logs of the most recent iteration\n")
    let doc = mupdf.PDFDocument.openDocument(fs.readFileSync("test_files/test1.pdf"))
    for  (var i = 0; i< doc.countPages(); i++){
        var page = doc.loadPage(i)
        let paths = pdf_extraction.get_paths_from_page(page)
        let drawings = pdf_extraction.group_paths_by_bb(paths)
        //fs.appendFileSync("test_files/log.txt", "\nEnded with following grouping: \n"+drawings.toString()+"\n")
        for (var j =0; j<drawings.length; j++){
            var drawing = drawings[j]
            if (drawing !== undefined){
                fs.appendFileSync("test_files/log.txt", "\nPage " +i + " Drawing Nr. " + j + "\n")
                pdf_extraction.export_drawing(drawing, "page"+i+"_nr"+j) // debugging purposes
                detect_graph_from_drawing(drawing)
            }
                
        }
    }
}

execute();