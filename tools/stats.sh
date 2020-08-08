# Converts an example log file to a trace and compares the output size

set -e

MyDir=$(dirname $(realpath $0))
BaseDir="$MyDir/.."
cd $BaseDir

OrigLogFile='example-data/example.logfile.log'

LogFile='scrap/example.logfile.log'
TraceFile='scrap/example.trace.json'

node dist/qlprof $OrigLogFile -o $TraceFile

TIMEFORMAT=%lU

time (gzip -c $OrigLogFile > $LogFile.gz) 2> $LogFile.gz.time
time (gzip -c $TraceFile > $TraceFile.gz) 2> $TraceFile.gz.time

time (xz -c $OrigLogFile > $LogFile.xz) 2> $LogFile.xz.time
time (xz -c $TraceFile > $TraceFile.xz) 2> $TraceFile.xz.time

function getSize {
    du -sh $1 | awk '{print $1}'
}

function getSizeAndTime {
    getSize $1; cat $1.time
}

function makeTable {
    echo '.' 'Size' 'GZ-size' 'GZ-time' 'XZ-size' 'XZ-time'
    echo 'Logfile' $(getSize $OrigLogFile) $(getSizeAndTime $LogFile.gz) $(getSizeAndTime $LogFile.xz)
    echo 'Trace' $(getSize $TraceFile) $(getSizeAndTime $TraceFile.gz) $(getSizeAndTime $TraceFile.xz)
}

makeTable | column -t
