import fs from 'fs';
import path from 'path';
import sass from 'sass';

import { Router } from 'express';
import { SCOPE } from './utils';

const PigmentSassMiddleware = Router();

let PigmentSassCache: string | undefined = undefined;

const USE_CACHE = process.env.NODE_ENV == 'production';

PigmentSassMiddleware.get(/^\/css\/pigment(\.min)?\.css/, (req, res, next) => {
  let minify = (process.env.NODE_ENV == 'production') || !!req.path.match(/\.min\.css$/);

  if(PigmentSassCache) return PigmentSassCache;

  let component_root = path.join(SCOPE.COMPONENT_ROOT || path.join(SCOPE.__dirname, '/components'));
  let shared_root = path.join(component_root, '/shared/styles');
  let ui_root = path.join(component_root, '/ui');
  let entity_root = path.join(component_root, '/entities');

  let sass_code = fs.readFileSync(path.join(__dirname, '..//sass/pigment.sass')).toString('utf-8');

  let shared_file_paths = recurse_component_paths(shared_root);
  let ui_file_paths = recurse_component_paths(ui_root);
  let entity_file_paths = recurse_component_paths(entity_root);
  
  shared_file_paths.sort((_a, _b) => {
    let a = _a.match(/[\\\/](_+)[^/\\]+\.sass/i)?.[1]?.length ?? 0;
    let b = _b.match(/[\\\/](_+)[^/\\]+\.sass/i)?.[1]?.length ?? 0;

    return b-a;
  }).forEach(f => {
    sass_code += '\r\n\r\n' + fs.readFileSync(f).toString('utf-8');
  })

  ui_file_paths.forEach(f => {
    sass_code += '\r\n\r\n' + fs.readFileSync(f).toString('utf-8');
  })

  entity_file_paths.forEach(f => {
    sass_code += '\r\n\r\n' + fs.readFileSync(f).toString('utf-8');
  })

  let css = sass.compileString(sass_code, {
    syntax: 'indented',
    style: minify ? 'compressed' : 'expanded'
  }).css;

  if(USE_CACHE) PigmentSassCache = css;

  return res.header('content-type', 'text/css').send(css);
})

const PigmentCustomSassCache: {[path: string]: string} = {};

PigmentSassMiddleware.get(/^\/css\/.+\.css$/, (req, res, next) => {
  let minify = (process.env.NODE_ENV == 'production') || !!req.path.match(/\.min\.css$/);

  let sass_file_path = path.join(SCOPE.__dirname, req.path.replace('/css', '/sass').replace(/(\.min)?\.css/, '.sass'));

  if(PigmentCustomSassCache[sass_file_path]) return PigmentCustomSassCache[sass_file_path];

  if(!fs.existsSync(sass_file_path)) return next();

  let css = sass.compile(sass_file_path, {
    style: minify ? 'compressed' : 'expanded',
    loadPaths: [path.join(SCOPE.__dirname, '/sass')]
  }).css;

  if(USE_CACHE) PigmentCustomSassCache[sass_file_path] = css;

  return res.header('content-type', 'text/css').send(css);
})

PigmentSassMiddleware.get(/^\/pigment\/.+\.css$/, (req, res, next) => {
  let minify = (process.env.NODE_ENV == 'production') || !!req.path.match(/\.min\.css$/);
  
  let sass_file_path = path.join(__dirname, '../', req.path.replace('/pigment', '/sass').replace(/(\.min)?\.css/, '.sass'));
  
  if(PigmentCustomSassCache[sass_file_path]) return PigmentCustomSassCache[sass_file_path];

  if(!fs.existsSync(sass_file_path)) return next();

  let css = sass.compile(sass_file_path, {
    style: minify ? 'compressed' : 'expanded',
    loadPaths: [path.join(SCOPE.__dirname, '/sass')]
  }).css;

  if(USE_CACHE) PigmentCustomSassCache[sass_file_path] = css;

  return res.header('content-type', 'text/css').send(css);
})

const recurse_component_paths = (component_path: string): string[] => {
  try {
    let component_path_children = fs.readdirSync(component_path);
  
    let component_sass_files = component_path_children.filter(c => c.match(/\.sass$/)).map(f => path.join(component_path, f));
  
    let nested_sass_files: string[] = [];
    for(let i = 0; i < component_path_children.length; i++) {
      let child_full_path = path.join(component_path, component_path_children[i]);
      if(fs.statSync(child_full_path).isDirectory()) nested_sass_files.push(...recurse_component_paths(child_full_path));
    }
  
    return [...component_sass_files, ...nested_sass_files];
  } catch(e) {
    return [];
  }
}

export default PigmentSassMiddleware;
