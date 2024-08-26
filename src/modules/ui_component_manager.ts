import fs from 'fs';
import path from 'path';

import { SCOPE } from './utils';

export default class UIComponentManager {
  static components: {[name: string]: string} = {}
  static parsed: boolean = false

  static generate() {
    try {
      let mixin_items: string[] = [];

      let component_paths_root = path.join(SCOPE.__dirname, '/components/ui/');
      const component_paths = fs.readdirSync(component_paths_root);

      component_paths.forEach(p => {
        try {
          let component_path = path.join(component_paths_root, p, `${p}.pug`);
  
          mixin_items.push(`mixin ${p}\n` + fs.readFileSync(component_path, 'utf-8').toString().replace(/[\r\n]+/g, '\n').replace(/^/gm, '  '));
        } catch(e) {}
      });
  
      let out = mixin_items.join('\n\n');

      fs.writeFileSync(path.join(__dirname, '../views/_mixins_generated.pug'), out);

      return out;
    } catch(e) {
      return [];
    }
  }
}

