import { execute_file } from "../src/pipeline.js";
import ReactDOM from "react-dom/client";
import { GraphHarvesterApplet } from "graph-harvester-react";
import "bootstrap/dist/css/bootstrap.min.css";
import React from "react";


ReactDOM.createRoot(document.getElementById("root")!).render(
    <GraphHarvesterApplet
        backend={{
            type: "local",
            callback: async (file) => {
                const logs : string[] = ["Initializing logs"]    
                const buffer = await file.arrayBuffer()
                execute_file(buffer,logs)
                console.log(logs.join("\n"))
                return [];
            },
        }}
    />
);
