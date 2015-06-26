module.exports = {
    createCsvString: function(jsonData) {
        var keys = Object.keys(jsonData[0]),
            csv = [keys.join(",")];
        
        var row = new Array( keys.length );
        for (var i = 0; i < jsonData.length; i++) {
            for (var j = 0; j < keys.length; j++) {
                if (typeof jsonData[i][keys[j]] === 'string') {
                    row[j] = '"' + escapeCsv(jsonData[i][keys[j]]) + '"';
                } else {
                    row[j] = jsonData[i][keys[j]] || '';
                }
            }
            csv.push(row.join(','));
        }
        
        return csv.join("\n");
    }
};

function escapeCsv(x) {
    if (x) {
        return ('' + x).replace( /[",\n\r]/gi, '' );
    } else {
        return ('');
    }
}