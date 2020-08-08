# Converts an example log file to a trace and compares the output size

set -e

MyDir=$(dirname $(realpath $0))
BaseDir="$MyDir/.."
cd $BaseDir

LogFile='example-data/example.logfile.log'
TraceFile='scrap/example.trace.json'
LogFileGz='scrap/example.logfile.log.gz'
TraceFileGz="$TraceFile.gz"
LogFileXz='scrap/example.logfile.log.xz'
TraceFileXz="$TraceFile.xz"

node dist/qlprof $LogFile -o $TraceFile

gzip -c $LogFile > $LogFileGz
gzip -c $TraceFile > $TraceFileGz

xz -c $LogFile > $LogFileXz
xz -c $TraceFile > $TraceFileXz

function getsize {
    du -sh $1 | awk '{print $1}'
}

function makeTable {
    echo '.' 'Plain' '.gz' '.xz'
    echo 'Logfile' $(getsize $LogFile) $(getsize $LogFileGz) $(getsize $LogFileXz)
    echo 'Trace' $(getsize $TraceFile) $(getsize $TraceFileGz) $(getsize $TraceFileXz)
}

makeTable | column -t
