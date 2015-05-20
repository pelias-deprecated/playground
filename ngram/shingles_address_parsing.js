
var test = require('tape'),
    elastictest = require('elastictest');

// ref: https://www.elastic.co/blog/searching-with-shingles

var exampleMapping = {
  mappings: {
    '_default_': {
      properties: {
        name: {
          dynamic : true,
          type: 'object',
        },
        shingle: {
          dynamic : true,
          type: 'object'
        }
      },
      dynamic_templates: [{
        template_1: {
          path_match: 'name.*',
          match_mapping_type: 'string',
          mapping: {
            type: 'string',
            analyzer: 'peliasTwoEdge'
          }
        }
      },{
        template_2: {
          path_match: 'shingle.*',
          match_mapping_type: 'string',
          mapping: {
            type: 'string',
            analyzer: 'peliasShingles'
          }
        }
      }],
      dynamic: 'true'
    }
  }
};

test.only( 'ngram street proximity', function(t){

  var suite = new elastictest.Suite();

  var analysis = {
    analyzer : {
      peliasTwoEdge : {
        "type": "custom",
        "tokenizer" : "standard",
        "filter": ["lowercase","asciifolding","trim","ampersand","prefixOneDigitNumbers","peliasTwoEdgeGramFilter", "removeAllZeroNumericPrefix","unique","notnull"]
      },
      peliasShingles: {
        "tokenizer":"whitespace",
        "filter": ["lowercase","asciifolding","trim","ampersand","peliasShinglesFilter","unique","notnull"]
      }
    },
    filter: {
      "ampersand" :{
        "type" : "pattern_replace",
        "pattern" : "[&]",
        "replacement" : " and "
      },
      "notnull" :{
        "type" : "length",
        "min" : 1
      },
      "prefixOneDigitNumbers" :{
        "type" : "pattern_replace",
        "pattern" : "^([1-9]{1})(.*)$",
        "replacement" : "00$1$2"
      },
      "removeAllZeroNumericPrefix" :{
        "type" : "pattern_replace",
        "pattern" : "^(0*)",
        "replacement" : ""
      },
      "peliasTwoEdgeGramFilter": {
        "type" : "edgeNGram",
        "min_gram" : 2,
        "max_gram" : 10
      },
      "peliasShinglesFilter": {
        "type": "shingle",
        "min_shingle_size": 2,
        "max_shingle_size": 12,
        "output_unigrams": false
      }
    }
  };

  var qb = function(admin) {
    return {
      "query": {
        "filtered": {
          "query": {
            "bool": {
              "must": [
                {
                  "match": {
                    "name.default": {
                      "query": "40 mapzen place " + admin
                    }
                  }
                }
              ],
              "should": [
                {
                  "multi_match": {
                    "query": "40 mapzen place " + admin,
                    "fields": [ 'shingle.*' ]
                  }
                }
              ]
            }
          }
        }
      }
    }
  };

  // drop index
  suite.action( function( done ){
    suite.client.indices.delete({
      index: suite.props.index
    }, done );
  });

  // recreate with default mapping
  suite.action( function( done ){
    suite.client.indices.create({
      index: suite.props.index,
      body: {
        mappings: exampleMapping.mappings,
        settings: { analysis: analysis },
        index: {
          number_of_shards: 1
        }
      }
    }, done);
  });

  // wait for es to update its mapping
  suite.action( function( done ){
    setTimeout( done, 1000 );
  });

  // index
  suite.action( function( done ){
    suite.client.index({
      index: suite.props.index,
      type: 'mytype',
      id: 1,
      body: {
        name: {
          default: "new york"
        },
        shingle: {
          default: "new york ny"
        }
      }
    }, done);
  });

  // index
  suite.action( function( done ){
    suite.client.index({
      index: suite.props.index,
      type: 'mytype',
      id: 2,
      body: {
        name: {
          default: "mapzen place"
        },
        shingle: {
          default: "mapzen place"
        }
      }
    }, done);
  });

  // index
  suite.action( function( done ){
    suite.client.index({
      index: suite.props.index,
      type: 'mytype',
      id: 3,
      body: {
        name: {
          default: "40 mapzen place"
        },
        shingle: {
          default: "40 mapzen place",
          default2: "40 mapzen place new york ny"
        }
      }
    }, done);
  });

  // index
  suite.action( function( done ){
    suite.client.index({
      index: suite.props.index,
      type: 'mytype',
      id: 4,
      body: {
        name: {
          default: "40 mapzen place"
        },
        shingle: {
          default: "40 mapzen place",
          default2: "40 mapzen place san francisco ca"
        }
      }
    }, done);
  });

  // suite.assert( function( done ){
  //   suite.client.indices.getMapping({
  //     index: suite.props.index,
  //     type: 'mytype'
  //   }, function( err, res ){
  //     var properties = res[suite.props.index].mappings.mytype.properties;
  //     t.deepEqual( properties.name.properties.default.analyzer, 'peliasTwoEdge' );
  //     t.deepEqual( properties.shingle.properties.default.analyzer, 'peliasShingles' );
  //     done();
  //   });
  // });

  // search new york
  suite.assert( function( done ){
    suite.client.search({
      index: suite.props.index,
      type: 'mytype',
      body: qb('new york'),
    }, function( err, res ){
      t.equal( res.hits.total, 4 );
      var hits = res.hits.hits;
      t.equal( hits[0]._source.shingle.default, '40 mapzen place' );
      t.equal( hits[0]._source.shingle.default2, '40 mapzen place new york ny' );
      t.equal( hits[1]._source.shingle.default2, '40 mapzen place san francisco ca' );
      t.equal( hits[2]._source.shingle.default, 'mapzen place' );
      done();
    });
  });

  // search SF
  suite.assert( function( done ){
    suite.client.search({
      index: suite.props.index,
      type: 'mytype',
      body: qb('san francisco'),
    }, function( err, res ){
      t.equal( res.hits.total, 3 );
      var hits = res.hits.hits;
      t.equal( hits[0]._source.shingle.default, '40 mapzen place' );
      t.equal( hits[0]._source.shingle.default2, '40 mapzen place san francisco ca' );
      t.equal( hits[1]._source.shingle.default2, '40 mapzen place new york ny' );
      t.equal( hits[2]._source.shingle.default, 'mapzen place' );
      done();
    });
  });

  suite.run( t.end );

});