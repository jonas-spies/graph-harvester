import { execute_file } from "../src/pipeline.js";

function main(){
    const input = document.getElementById("pdfInput") as HTMLInputElement;
    const logs : string[] = ["Initializing logs"]
    input.addEventListener("change", async () => {
        const file = input.files?.[0]
        if (!file)
            return
        const buffer = await file.arrayBuffer()
        
        execute_file(buffer,logs)
        console.log(logs.join("\n"))
    })
}

main()