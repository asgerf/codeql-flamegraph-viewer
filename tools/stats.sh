# Converts an example log file to a trace and compares the output size

set -e

MyDir=$(dirname $(realpath $0))
BaseDir="$MyDir/.."
cd $BaseDir

LogFile='example-data/example.logfile.log'
LogFileGz='scrap/example.logfile.log.gz'
TraceFile='scrap/example.trace.json'
TraceFileGz="$TraceFile.gz"

node dist/qlprof $LogFile -o $TraceFile

gzip -c $LogFile > $LogFileGz
gzip -c $TraceFile > $TraceFileGz

du -sh $LogFile $TraceFile $LogFileGz $TraceFileGz
