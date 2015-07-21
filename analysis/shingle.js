
var test = require('tape'),
    elastictest = require('elastictest');

// ref: http://www.elastic.co/guide/en/elasticsearch/reference/1.5/analysis-ngram-tokenizer.html

test.only( 'shingle analysis', function(t){

  var suite = new elastictest.Suite();

  var analysis = {
    analyzer : {
      "peliasShingles": {
        "tokenizer":"whitespace",
        "filter": ["lowercase","asciifolding","trim","ampersand","peliasShinglesFilter","unique","notnull"]
      }
    },
    filter: {
      "peliasShinglesFilter": {
        "type": "shingle",
        "min_shingle_size": 2,
        "max_shingle_size": 2,
        "output_unigrams": false
      },
      "ampersand" :{
        "type" : "pattern_replace",
        "pattern" : "and",
        "replacement" : "&"
      },
      "notnull" :{
        "type" : "length",
        "min" : 1
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
      body: { settings: { analysis: analysis } }
    }, done);
  });

  // wait for es to update its mapping
  suite.action( function( done ){
    setTimeout( done, 1000 );
  });

  // shingles
  suite.assert( function( done ){
    suite.client.indices.analyze({
      index: suite.props.index,
      analyzer: 'peliasShingles',
      text: 'johnson & johnson'
    }, function( err, res ){
      var tokens = simpleTokens( res.tokens );
      t.deepEqual( tokens, [ 'johnson &', '& johnson' ] );
      done();
    });
  });

  // shingles
  suite.assert( function( done ){
    suite.client.indices.analyze({
      index: suite.props.index,
      analyzer: 'peliasShingles',
      text: '401 dean street'
    }, function( err, res ){
      var tokens = simpleTokens( res.tokens );
      t.deepEqual( tokens, [ '401 dean', 'dean street' ] );
      done();
    });
  });

  suite.run( t.end );

});

function simpleTokens( tokens ){
  return tokens.map( function( t ){
    return t.token;
  });
}