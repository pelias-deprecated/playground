
var test = require('tape'),
    elastictest = require('elastictest');

// http://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-root-object-type.html#_dynamic_templates

var exampleMapping = {
  mappings: {
    'mytype': {
      properties: {
        name: {
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
            analyzer: 'english'
          }
        }
      }],
      dynamic: 'true'
    }
  }
};

test.only( 'dynamic_templates', function(t){

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

  // wait for es to update its mapping
  suite.action( function( done ){
    setTimeout( done, 1000 );
  });

  // index a document
  suite.action( function( done ){
    suite.client.index({
      index: suite.props.index,
      type: 'mytype',
      id: '1',
      body: {
        name: {
          default: 'peter',
          foo: 'bar'
        },
        color: 'red'
      }
    }, done );
  });

  // get mapping
  suite.assert( function( done ){
    suite.client.indices.getMapping({
      index: suite.props.index,
      type: 'mytype'
    }, function( err, res ){

      var properties = res[suite.props.index].mappings.mytype.properties;
      t.equal( properties.name.dynamic, 'true' );

      var nameProperties = properties.name.properties;
      t.deepEqual( nameProperties.default, { type: 'string', analyzer: 'english' } );
      t.deepEqual( nameProperties.foo, { type: 'string', analyzer: 'english' } );

      t.deepEqual( properties.color, { type: 'string' } );
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