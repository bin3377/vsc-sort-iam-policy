// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "iam-policy" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('iam-policy.sort', () => {
		sortIAMPolicy();
	});

	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('iam-policy.group', () => {
		groupIAMPolicy();
	});

}

// this method is called when your extension is deactivated
export function deactivate() { }

function getJSON(activeEditor: vscode.TextEditor) {
	const doc = activeEditor.document;
	let jsonObj: any = undefined;
	try {
		jsonObj = JSON.parse(doc.getText());
	}
	catch (e) {
		vscode.window.showErrorMessage('Failed to parse IAM Policy');
		console.log("Error:", e);
		return;
	}
	let statements = jsonObj.Statement;
	if (!statements) {
		vscode.window.showErrorMessage('Not a valid IAM policy');
		return;
	}
	return jsonObj;
}

function sortJSON(jsonObj: any) {
	for (let st of jsonObj.Statement) {
		let action:string[] = st.Action;
		let resource:string[] = st.Resource;
		if (Array.isArray(action)) {
			action.sort();
			st.Action = action;
		}
		if (Array.isArray(resource)) {
			resource.sort();
			st.Resource = resource;
		}
	}
}

function rewriteJSON(activeEditor: vscode.TextEditor, jsonObj: any) {
	const doc = activeEditor.document;
	// console.log(jsonObj);
	
	activeEditor.edit(editBuilder => {
		let invalidRange = new vscode.Range(0, 0, doc.lineCount, 0);
		let fullRange = doc.validateRange(invalidRange);
		editBuilder.replace(fullRange, JSON.stringify(jsonObj));
	});

	vscode.commands.executeCommand("editor.action.formatDocument");

}

function sortIAMPolicy() {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		return;
	}
	let jsonObj = getJSON(activeEditor);
	if (!jsonObj) {
		return;
	}
	sortJSON(jsonObj);
	rewriteJSON(activeEditor, jsonObj);
}

function groupIAMPolicy() {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		return;
	}
	let jsonObj = getJSON(activeEditor);
	if (!jsonObj) {
		return;
	}
	sortJSON(jsonObj);

	function newSt(org: any, prefix: string, resource: any) {
		const action : string[] = [];
		if (Array.isArray(resource)) {
			resource = resource.filter(function (res) {
				return res.startsWith(`arn:aws:${ prefix }:`);
			});
		}
		let newSt = { ...org };
		newSt.Sid = org.Sid + "-" + prefix;
		newSt.Action = action;
		newSt.Resource = resource;
		return newSt;
	}

	let newStatements: any[] = [];
	for (let st of jsonObj.Statement) {
		if (!Array.isArray(st.Action)) {
			newStatements.push(st);
			continue;
		}
		
		let prefix:string = "";
		let ns = newSt(st, prefix, st.Resource);
		for (let i = 0; i < st.Action.length; i++) {
			const fields = st.Action[i].split(":", 2);
			if (fields[0] !== prefix) {
				if (ns.Action.length !== 0) {
					newStatements.push(ns);
				}
				prefix = fields[0];
				ns = newSt(st, prefix, st.Resource);
			}
			ns.Action.push(st.Action[i]);
		}
		if (ns.Action.length === st.Action.length) {
			// all actions have same prefix
			newStatements.push(st);
		} else if (ns.Action.length !== 0) {
			newStatements.push(ns);
		}
	}
	
	jsonObj.Statement = newStatements;
	rewriteJSON(activeEditor, jsonObj);
}
