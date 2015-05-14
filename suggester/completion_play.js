
var test = require('tape'),
    elastictest = require('elastictest');

/**
  This is an experiment in indexing a document twice using
  2x different suggesters, one which splits the `input` on
  whitespace before indexing and one which does not.

  The result is that when using the suggester where the tokens have
  been split we can suggest on words in the middle of a phrase.
**/

var exampleMapping = {
  mappings: {
    'mytype': {
      properties: {
        'suggest_tokens': {
          type : 'completion',
          index_analyzer : 'standard',
          search_analyzer : 'standard'
        },
        'suggest_phrase': {
          type : 'completion',
          index_analyzer : 'standard',
          search_analyzer : 'standard'
        }
      }
    }
  }
};

test.only( 'suggester', function(t){

  var suite = new elastictest.Suite();

  // drop index
  suite.action( function( done ){
    suite.client.indices.delete({
      index: suite.props.index
    }, done );
  });

  // recreate with mapping
  suite.action( function( done ){
    suite.client.indices.create({
      index: suite.props.index,
      body: exampleMapping
    }, done );
  });

  // index some documents
  [
    '101 old street',
    '102 old street',
    'Old grey goose',
    'mapzen place 101',
    'mapzen place 10'
  ]
  .forEach( function( name, i ){
    suite.action( function( done ){
      suite.client.index({
        index: suite.props.index,
        type: 'mytype',
        id: ( i+100 ),
        body: {
          'suggest_tokens': {
            input: name.split(' '),
            output: name
          },
          'suggest_phrase': {
            input: [ name ],
            output: name
          }
        }
      }, done );
    });
  });

  // string text
  testSuggesters( suite, t, {
    text: 'old',
    token_match: [
      '101 old street',
      '102 old street',
      'Old grey goose'
    ],
    phrase_match: [
      'Old grey goose'
    ]
  });

  // number text
  testSuggesters( suite, t, {
    text: '101',
    token_match: [
      '101 old street',
      'mapzen place 101'
    ],
    phrase_match: [
      '101 old street'
    ]
  });

  suite.run( t.end );

});

function testSuggesters( suite, t, opts ){
  suite.assert( function( done ){
    suite.client.suggest({
      index: suite.props.index,
      type: 'mytype',
      body: {
        'token_suggester': {
          text: opts.text,
          completion: {
            field: 'suggest_tokens'
          }
        },
        'phrase_suggester': {
          text: opts.text,
          completion: {
            field: 'suggest_phrase'
          }
        }
      }
    }, function( err, res ){

      // token
      var tSuggestions = res['token_suggester'];
      t.equal( tSuggestions.length, 1 );
      t.equal( tSuggestions[0].text, opts.text );
      t.equal( tSuggestions[0].offset, 0 );
      t.equal( tSuggestions[0].length, opts.text.length );
      t.true( Array.isArray( tSuggestions[0].options ) );
      t.equal( tSuggestions[0].options.length, opts.token_match.length, 'text token suggestions' );

      opts.token_match.forEach( function( output, i ){
        t.deepEqual( tSuggestions[0].options[i], {
          score: 1,
          text: output
        });
      });

      // phrase
      var pSuggestions = res['phrase_suggester'];
      t.equal( pSuggestions.length, 1 );
      t.equal( pSuggestions[0].text, opts.text );
      t.equal( pSuggestions[0].offset, 0 );
      t.equal( pSuggestions[0].length, opts.text.length );
      t.true( Array.isArray( pSuggestions[0].options ) );
      t.equal( pSuggestions[0].options.length, opts.phrase_match.length, 'text phrase suggestions' );
      
      opts.phrase_match.forEach( function( output, i ){
        t.deepEqual( pSuggestions[0].options[i], {
          score: 1,
          text: output
        });
      });

      done();
    });
  });
}