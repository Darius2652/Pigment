#!/usr/bin/env node

const args = process.argv.slice(2);

const fail = (message: string) => {
  console.error(`ERROR! ${message}`);
  console.info(`To see a list of supported pigment commands, run:\r\n  pigment help`)
  process.exit(1);
}

interface Flag {
  name: string,
  description: string,
  shorthand?: string,
  argument?: boolean,
  type?: "string" | "number" | "boolean" | undefined,
  default_value?: any,
  value?: any,
  execute: Function,
  hide_in_help?: boolean,
}

const flag_values = {
  page: 1,
  no_git: false,
}

const flags: Flag[] = [
  {
    name: "no-git",
    shorthand: "ng",
    argument: false,
    default_value: false,
    description: "When passed to `pigment create`, your project won't be initialized as a git repository",
    execute: () => {
      flag_values.no_git = true;
    }
  },
  {
    name: "page",
    description: "",
    shorthand: "p",
    argument: true,
    default_value: 1,
    type: 'number',
    hide_in_help: true,
    execute: function(newValue: number) {
      flag_values.page = Math.max(1, newValue);
    }
  },
]

interface Command {
  arguments?: string[]
  execute: Function,
  description: string,
}

const HELP_ITEMS_PER_PAGE = 5;

const commands: {[key: string]: Command} = {
  create: {
    description: "Create and initialize a new Pigment project",
    arguments: ['name'],
    execute: (name: string) => {
      console.log(`Creating ${name}`);
    }
  },
  help: {
    description: "Shows this help screen",
    arguments: ['[flags]'],
    execute: (param1?: string) => {
      if(param1 && param1.toLowerCase) {
        if(param1.toLowerCase() != 'flags') fail(`${param1} is not a valid argument for \`pigment help\``);
        console.table(flags.filter(f => !f.hide_in_help), ['name', 'shorthand', 'description']);
      } else {
        console.log(`Pigment Help - Page ${flag_values.page}\r\n\r\n`);
        let page_commands: {name: string, description: string, arguments: string}[] = Object.keys(commands)
          .slice((flag_values.page-1)*HELP_ITEMS_PER_PAGE, HELP_ITEMS_PER_PAGE)
          .map(key => {
            return {
              name: key,
              description: commands[key].description || "",
              arguments: (commands[key].arguments || []).join(', '),
            }
          });
  
        console.table(page_commands);
      }
    }
  }
}

const flag_args: [Flag, string?][] = []
const remaining_args: string[] = []

for(let i = 0; i < args.length; i++) {
  let arg = args[i];
  let flag: Flag | undefined;

  if(arg.match(/^--/)) {
    flag = flags.find(f => f.name == arg.replace('--', '').toLowerCase());
    if(!flag) fail(`Unknown flag '${arg}'`);
  } else if(arg.match(/^-/)) {
    flag = flags.find(f => f.shorthand == arg.replace('-', '').toLowerCase());
    if(!flag) fail(`Unknown flag '${arg}'`);
  }

  if(flag) {
    if(flag.argument) {
      if(i == args.length - 1) fail(`Value required for ${arg}`);
      let argument: any = args[i+1];
      switch(flag.type) {
        case 'boolean':
          argument = argument?.toString()?.toLowerCase()?.indexOf('t') == 0;
          break;
        case 'number':
          argument = parseInt(argument);
          if(!argument) fail(`Invalud value passed for ${arg}`);
          break;
      }
      flag_args.push([flag, argument]);
      i++;
    } else {
      flag_args.push([flag]);
    }
  } else {
    remaining_args.push(arg);
  }
}

let command_arg_check = remaining_args[0];
if(!command_arg_check) fail('No command provided');
let command_arg = command_arg_check.toLowerCase();
let command = commands[command_arg];
if(!command) fail(`${command_arg_check} is not a valid Pigment command`)

flag_args.forEach(([flag, ...args]) => {
  console.log(flag);
  console.log(args);
  flag.execute(...args);
})

command.execute(...remaining_args.slice(1))