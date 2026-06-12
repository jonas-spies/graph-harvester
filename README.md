Current functionality:
three nodejs scripts: 'dev' will run the pipeline on a testfile 'test_files/test2.pdf'. 'benchmark' will run it on all files in 'test_files/benchmark/TP' and compare to graphs parsed from .gv files in the same folder. 'browser' will start a web application where users can upload a single PDF file to run the pipeline on (no direct feedback, but console messages).
The pipeline can:
- detect vertices lying on an endpoint or between two endpoints of an edge and link them to the corresponding edges
- link edges incident to one (half orphans) or no vertices (orphans) together to create a larger edge incident to two endpoints
- break up a large edge incident to multiple vertices into a set of smaller edges where each start and endpoint is incident to a vertex
- detect implied vertices at the intersection of three or more edges
