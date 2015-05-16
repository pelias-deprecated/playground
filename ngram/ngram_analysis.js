
var test = require('tape'),
    elastictest = require('elastictest');

// ref: http://www.elastic.co/guide/en/elasticsearch/reference/1.5/analysis-ngram-tokenizer.html

test.only( 'ngram analysis', function(t){

  var suite = new elastictest.Suite();

  var analysis = {
    analyzer : {
      a_ngram1 : { tokenizer : 'ngram1' },
      // a_ngram2 : {
      //   tokenizer : 'ngram2',
      //   filter: [ 'lowercase', 'address_stop' ]
      // },
      a_ngram3 : {
        "type": "custom",
        "tokenizer" : "standard",
        "filter": ["lowercase","asciifolding","trim","address_stop","ampersand","peliasTwoEdgeGramFilter"]
      },
      // a_ngram4 : {
      //   "type": "custom",
      //   "tokenizer" : "standard",
      //   "filter": ["lowercase","asciifolding","trim","address_stop","ampersand","peliasOneEdgeGramFilter"]
      // },
      peliasTwoEdge : {
        "type": "custom",
        "tokenizer" : "standard",
        "filter": ["lowercase","asciifolding","trim","ampersand","prefixOneDigitNumbers","peliasTwoEdgeGramFilter", "removeAllZeroNumericPrefix","unique","notnull"]
      },
      peliasThreeEdge : {
        "type": "custom",
        "tokenizer" : "standard",
        "filter": ["lowercase","asciifolding","trim","ampersand","prefixOneDigitNumbers","prefixTwoDigitNumbers","peliasThreeEdgeGramFilter", "removeAllZeroNumericPrefix","unique","notnull"]
      }
    },
    tokenizer : {
      ngram1 : {
        type : 'nGram',
        min_gram : 2,
        max_gram : 3,
        token_chars: [ 'letter', 'digit' ]
      },
    //   ngram2 : {
    //     type : 'edgeNGram',
    //     min_gram : 1,
    //     max_gram : 999,
    //     token_chars: [ 'letter', 'digit' ]
    //   }
    },
    filter: {
      address_stop: {
        type: 'stop',
        stopwords: [ 'street', 'road', 'avenue', 'place' ]
      },
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
      "prefixTwoDigitNumbers" :{
        "type" : "pattern_replace",
        "pattern" : "^([1-9]{2})(.*)$",
        "replacement" : "0$1$2"
      },
      "removeAllZeroNumericPrefix" :{
        "type" : "pattern_replace",
        "pattern" : "^(0*)",
        "replacement" : ""
      },
      "peliasOneEdgeGramFilter": {
        "type" : "edgeNGram",
        "min_gram" : 1,
        "max_gram" : 10
      },
      "peliasTwoEdgeGramFilter": {
        "type" : "edgeNGram",
        "min_gram" : 2,
        "max_gram" : 10
      },
      "peliasThreeEdgeGramFilter": {
        "type" : "edgeNGram",
        "min_gram" : 3,
        "max_gram" : 10
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

  // a_ngram1
  suite.assert( function( done ){
    suite.client.indices.analyze({
      index: suite.props.index,
      analyzer: 'a_ngram1',
      text: '101 mapzen place'
    }, function( err, res ){
      var tokens = simpleTokens( res.tokens );
      t.deepEqual( tokens, [ '10', '101', '01', 'ma', 'map', 'ap', 'apz', 'pz', 'pze', 'ze', 'zen', 'en', 'pl', 'pla', 'la', 'lac', 'ac', 'ace', 'ce' ] );
      done();
    });
  });

  // peliasTwoEdge
  suite.assert( function( done ){
    suite.client.indices.analyze({
      index: suite.props.index,
      analyzer: 'peliasTwoEdge',
      text: '1 1a 22 01a 10c 100 Mapzen place'
    }, function( err, res ){
      var tokens = simpleTokens( res.tokens );
      t.deepEqual( tokens, [ '1', '1a', '2', '22', '10', '10c', '100', 'ma', 'map', 'mapz', 'mapze', 'mapzen', 'pl', 'pla', 'plac', 'place' ] );
      done();
    });
  });

  // peliasThreeEdge
  suite.assert( function( done ){
    suite.client.indices.analyze({
      index: suite.props.index,
      analyzer: 'peliasThreeEdge',
      text: '1 1a 22 01a 10c 100 Mapzen place'
    }, function( err, res ){
      var tokens = simpleTokens( res.tokens );
      t.deepEqual( tokens, [ '1', '1a', '2', '22', '10', '10c', '100', 'map', 'mapz', 'mapze', 'mapzen', 'pla', 'plac', 'place' ] );
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