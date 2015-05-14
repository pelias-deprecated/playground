
var test = require('tape'),
    elastictest = require('elastictest');

// http://www.elastic.co/guide/en/elasticsearch/reference/current/search-suggesters-completion.html

var exampleMapping = {
  mappings: {
    'mytype': {
      properties: {
        'suggestme': {
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

  // index a document
  suite.action( function( done ){
    suite.client.index({
      index: suite.props.index,
      type: 'mytype',
      id: '1',
      body: {
        'suggestme': {
          input: [ 'At the Drive-in' ],
          output: 'At the Drive-in'
        }
      }
    }, done );
  });

  // term we are searching for (autocomplete text)
  var text = 'at';

  // perform suggestion
  suite.assert( function( done ){
    suite.client.suggest({
      index: suite.props.index,
      type: 'mytype',
      body: {
        'mysuggester': {
          text: text,
          completion: {
            field: 'suggestme'
          }
        }
      }
    }, function( err, res ){

      var suggestions = res['mysuggester'];
      t.equal( suggestions.length, 1 );
      t.equal( suggestions[0].text, text );
      t.equal( suggestions[0].offset, 0 );
      t.equal( suggestions[0].length, text.length );
      t.true( Array.isArray( suggestions[0].options ) );
      t.equal( suggestions[0].options.length, 1 );
      t.deepEqual( suggestions[0].options[0], {
        score: 1,
        text: 'At the Drive-in'
      });

      done();
    });
  });

  suite.run( t.end );

});