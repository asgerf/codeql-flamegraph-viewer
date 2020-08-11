AllTraceFiles=""

function getSize {
    du -sh $1 | awk '{print $1}'
}

function getSizeAndTime {
    getSize $1; cat $1.time
}

echo "Project" Logfile Trace "GZ-Size" GZ-Time XZ-Size XZ-Time

TIMEFORMAT=%lU
for LogFile in $@; do
    name=$(basename $LogFile)
    node dist/qlprof $LogFile -o scrap/$name.json

    TraceFile=scrap/$name.json
    time (gzip -c $TraceFile > $TraceFile.gz) 2> $TraceFile.gz.time
    time (xz -c $TraceFile > $TraceFile.xz) 2> $TraceFile.xz.time

    echo "$name" $(getSize $LogFile) $(getSize $TraceFile) $(getSizeAndTime $TraceFile.gz) $(getSizeAndTime $TraceFile.xz)

    AllTraceFiles="$AllTraceFiles $TraceFile"
done

time (gzip -c $AllTraceFiles > scrap/AllTraceFiles.gz) 2> scrap/AllTraceFiles.gz.time
time (xz -c $AllTraceFiles > scrap/AllTraceFiles.xz) 2> scrap/AllTraceFiles.xz.time

echo "Compressed-together" "N/A" "N/A" $(getSizeAndTime scrap/AllTraceFiles.gz) $(getSizeAndTime scrap/AllTraceFiles.xz)
