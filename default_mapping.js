
var test = require('tape'),
    elastictest = require('elastictest');

// ref: http://www.elastic.co/guide/en/elasticsearch/guide/master/default-mapping.html

var exampleDefaultMapping = {
  mappings: {
    _default_: {
      properties: {
        birthday: {
          type: 'integer',
        }
      }
    }
  }
};

test( '_default_ mapping - at index creation', function(t){

  var suite = new elastictest.Suite();

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
      body: exampleDefaultMapping
    }, done );
  });

  // ensure _default_ mapping is set
  suite.assert( function( done ){
    suite.client.indices.getMapping({
      index: suite.props.index,
      type: '_default_'
    }, function( err, res ){
      t.deepEqual( res[suite.props.index], exampleDefaultMapping, 'mapping set' );
      done();
    });
  });

  suite.run( t.end );

});

test( '_default_ mapping - update existing mapping', function(t){

  var suite = new elastictest.Suite();

  // update existing index mapping
  suite.action( function( done ){
    suite.client.indices.putMapping({
      index: suite.props.index,
      type: '_default_',
      body: exampleDefaultMapping.mappings._default_
    }, done );
  });

  // ensure _default_ mapping is set
  suite.assert( function( done ){
    suite.client.indices.getMapping({
      index: suite.props.index
    }, function( err, res ){
      t.deepEqual( res[suite.props.index], exampleDefaultMapping, 'mapping set' );
      done();
    });
  });

  suite.run( t.end );

});

test( '_default_ mapping - inherited when creating new types', function(t){

  var suite = new elastictest.Suite();

  // update existing index mapping
  suite.action( function( done ){
    suite.client.indices.putMapping({
      index: suite.props.index,
      type: '_default_',
      body: exampleDefaultMapping.mappings._default_
    }, done );
  });

  // index a document to a _type for which
  // no mapping has been defined yet
  suite.action( function( done ){
    suite.client.index({
      index: suite.props.index,
      type: 'mytype',
      id: '1',
      body: {
        name: 'peter',
        birthday: '01'
      }
    }, done );
  });

  // ensure mytype mapping is created and correctly inherited
  // from the _default_ mapping
  suite.assert( function( done ){
    suite.client.indices.getMapping({
      index: suite.props.index,
      type: 'mytype'
    }, function( err, res ){
      var properties = res[suite.props.index].mappings.mytype.properties;
      t.deepEqual( properties.birthday, { type: 'integer' }, 'inherited property' );
      t.deepEqual( properties.name, { type: 'string' }, 'type-specific property' );
      done();
    });
  });

  suite.run( t.end );

});