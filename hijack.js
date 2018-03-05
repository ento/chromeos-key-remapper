/* Rewrite calls to chrome.input.ime.onX.addListener as
   Remapper.hijack.onX.addListener.
*/

var fs = require('fs');
const jscodeshift = require('jscodeshift');

function baseFilter() {
  return {
    callee: {
      property: {name: "addListener"},
      object: {
        object: {
          property: {name: "ime"},
          object: {
            property: {name: "input"},
            object: {
              name: "chrome"
            }
          }
        }
      }
    }
  };
}

// filter for calls like `ime.onKeyData`
function propertyMemberFilter() {
  const filter = baseFilter();
  filter.callee.object.computed = false; // ignore dynamic member lookup like `ime[eventName]`
  filter.callee.object.property = {type: "Identifier"};
  return filter;
}

function propertyMemberEvent(path) {
  return path.node.callee.object.property.name;
}

// filter for calls like `ime["onKeyData"]`
function literalMemberFilter() {
  const filter = baseFilter();
  filter.callee.object.computed = true;
  filter.callee.object.property = {type: "Literal"};
  return filter;
}

function literalMemberEvent(path) {
  return path.node.callee.object.property.value;
}

function rewrite(j, getEventName) {
  return function(path) {
    {
      j(path).replaceWith(
        j.callExpression(j.memberExpression(
          j.memberExpression(
            j.memberExpression(
              j.identifier("Remapper"),
              j.identifier("hijack"), // onX
              false),
            j.identifier(getEventName(path)), // onX
            false),
          j.identifier(path.node.callee.property.name), // addListener
        false),
        path.node.arguments)
      );
    }
  };
}

function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  root.find(j.CallExpression, propertyMemberFilter())
    .forEach(rewrite(j, propertyMemberEvent));
  root.find(j.CallExpression, literalMemberFilter())
    .forEach(rewrite(j, literalMemberEvent))
  return root.toSource();
}

if (process.argv.length < 4) {
  console.error("you should be invoking waf instead of this script, but if you really need to know:");
  console.error('usage: node hijack.js input_path output_path');
  process.exit(1);
}

// the jscodeshift command rewrites files in place, and waf doesn't
// like it when the input and output are the same file. so this is a
// simple wrapper around the jscodeshift transformer function that
// reads JS code from the specified input path, transforms it, and
// writes to the specified output path.
fs.readFile(process.argv[2], {encoding: 'utf8'}, function(err, source) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  var result = transformer({source: source}, {jscodeshift: jscodeshift});
  fs.writeFile(process.argv[3], result, function(err) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
  });
})
