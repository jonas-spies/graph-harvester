The graph harvester can extract graph drawings from vector drawings contained in PDF files.
For an explanation to how it works, please read the report.
The project consists of three nodejs scripts that allow interaction with the pipeline:
1) 'browser' will start the frontend, allowing interaction as intended for an ordinary user.
2) 'benchmark' requires two hardcoded directories to contain files. One with .gv files to parse reference graphs with (name of the file must correspond to the name of the PDF file it originates from), and one with files to run through the pipeline. The system will try to match as many of the reference graphs as possible to a graph detected in the pipeline from the same paper.
3) 'dev' will run one hardcoded file without the need of starting or interacting with the frontend.

It is possible to set two flags at the entry point, which is frontend/main.tsx:
at the point where execute_file() is used, setting hog to true will enable interaction with the House of Graphs API to try and get the ID of each detected graph corresponding to its entry in the database. Additionally, passing the object called 'logs' will enable console logging to help with debugging.

Here is a list of all parameters that allow for experimentation to obtain potentially different results: 
Figure Extraction: pdf_extraction.ts/DRAWING_AREA_THRESHOLD may filter very small graph drawings, preventing them to enter the pipeline.

Filter behavior: graph_detection.ts contains most parameters that determine what objects are considered a valid vertex / edge candidate. #
Additionally, geometry_utils.ts/MAX_CURVES_PER_VERTEX determines how complex the shape of a vertex candidate is allowed to be.

Edge extension: if an edge has not found an incident object at one of its endpoints, the edge will be extended. Parameters relevant to that are in graph_detection.ts.
Additionally, wrappers.ts/Stroke/EXTENSION_MAXIMUM determines limit of how far an edge may be extended relative to its own length.

Incidence detection: geometry_utils.ts contains the parameters that change at what point two objects are considered incident.