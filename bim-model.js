
import {Color,MeshBasicMaterial, OrthographicCamera, AmbientLight, AxesHelper, DirectionalLight,GridHelper,PerspectiveCamera,Scene,WebGLRenderer, MeshStandardMaterial,} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { IfcViewerAPI } from "web-ifc-viewer";
import {IFCWALL, IFCSLAB, IFCDOOR,IFCWINDOW,IFCFURNISHINGELEMENT,IFCMEMBER,IFCPLATE,IFCBEAM,IFCCOLUMN, IFCBUILDINGELEMENTPROXY,} from "web-ifc";
import Drawing from "dxf-writer";

//identifica el contenedor, instancia un viewer, añade ejes y rejilla
const container = document.getElementById("viewer-container");
const viewer = new IfcViewerAPI({
    container,
    backgroundColor: new Color(255, 255, 255),
});
viewer.axes.setAxes();
viewer.grid.setGrid();
viewer.grid.dispose();  // elimina grid

const ifcLoader = viewer.IFC.loader;
const ifcManager = ifcLoader.ifcManager;

const scene = viewer.context.getScene();
let model;
let allPlans;
let globalCamera = viewer.context.getCamera();
globalCamera.updateMatrixWorld();


//elementos input, cargan el archivo
const GUI = {
    input: document.getElementById("file-input"),
    loader: document.getElementById("loader-button"),
};


GUI.loader.onclick = () => GUI.input.click();

//evento cambio input
GUI.input.onchange = async (event) => {
    const file = event.target.files[0];
    const url = URL.createObjectURL(file);
    loadIfc(url);
};

async function loadIfc(url) {
    model = await viewer.IFC.loadIfcUrl(url);
    await viewer.shadowDropper.renderShadow(model.modelID);
    const items = viewer.context.items;
    items.pickableIfcModels = items.pickableIfcModels.filter(
        (model) => model !== model
    );
    items.ifcModels = items.ifcModels.filter((model) => model !== model);

    // For checkboxes
    model.removeFromParent();
   // togglePickable(model, false);
    
    await setupAllCategories();
    
    //elementos del IFC
    allIDs = getAllIds(model);
    console.log(allIDs);
    const subset = getWholeSubset(viewer, model, allIDs);
	replaceOriginalModelBySubset(viewer, model, subset);
    
    setupProgressNotification(viewer);
}


  
//Psets
/* window.ondblclick = async (event) => {
    
      var dataParsed = [];
      var ifcPickedElem = await viewer.IFC.selector.pickIfcItem(true,true);
      var psets = await ifcManager.getPropertySets(ifcPickedElem.modelID, ifcPickedElem.id, true);
      // var itemObj = await ifcManager.getItemProperties(ifcPickedElem.modelID, ifcPickedElem.id, true);
      console.log(psets);
     
      if(psets){
        psets.forEach(item => {
          var normalProps = item.HasProperties ? item.HasProperties : [];
          var quantityProps = item.Quantities ? item.Quantities : [];
          var allProps = normalProps.concat(quantityProps);
          allProps.forEach(property => {
            var valueProp = ObtainValueOfProp(property);
            dataParsed.push({
              displayCategory: DecodeUnicodeToString(item.Name.value),
              displayName: DecodeUnicodeToString(property.Name.value),
              displayValue: DecodeUnicodeToString(valueProp),
              attributeName: '',
              units: ''
            });
            //console.log(item.Name.value);
            console.log(property.Name.value);
            console.log(valueProp); 
          });
        });
      }

     const tableDOM = Tables.createTableFromProperties({properties: dataParsed, showTitle: true, showParamTitleRow: false});
      tableDOM.classList.add("properties-table");
      var propertiesPanelDomElem = document.getElementById("properties-panel");
      propertiesPanelDomElem.innerHTML = tableDOM.outerHTML;
 
  }; */ 
  function ObtainValueOfProp (property){
    if(property.NominalValue) {return property.NominalValue.value}
    if(property.LengthValue) {return property.LengthValue.value}
    if(property.AreaValue) {return property.AreaValue.value}
    if(property.VolumeValue) {return property.VolumeValue.value}
  }
  function DecodeUnicodeToString(ifcString)
    {
        const ifcUnicodeRegEx = /\\X2\\(.*?)\\X0\\/uig;
        let resultString = ifcString;
        let match = ifcUnicodeRegEx.exec(ifcString);
        while (match) {
          const unicodeChar = String.fromCharCode (parseInt (match[1], 16));
          resultString = resultString.replace (match[0], unicodeChar);
          match = ifcUnicodeRegEx.exec (ifcString);
        }
        return resultString;
    }


//devuelve todos los elementos del modelo
function getAllIds(ifcModel) {
	return Array.from(
		new Set(ifcModel.geometry.attributes.expressID.array),
	);
}

//llamada cuando carga un array, elimina elementos e incluye elemn con categorias creadas
function replaceOriginalModelBySubset(viewer, ifcModel, subset) {
	const items = viewer.context.items;

	items.pickableIfcModels = items.pickableIfcModels.filter(model => model !== ifcModel);
	items.ifcModels = items.ifcModels.filter(model => model !== ifcModel);
	ifcModel.removeFromParent();

	items.ifcModels.push(subset);
	items.pickableIfcModels.push(subset);
}

function getWholeSubset(viewer, ifcModel, allIDs) {
	return viewer.IFC.loader.ifcManager.createSubset({
		modelID: ifcModel.modelID,
		ids: allIDs,
		applyBVH: true,
		scene: ifcModel.parent,
		removePrevious: true,
		customID: 'full-model-subset',
	});
}


function showAllItems(viewer, ids) {
	viewer.IFC.loader.ifcManager.createSubset({
		modelID: 0,
		ids,
		removePrevious: false,
		applyBVH: true,
		customID: 'full-model-subset',
	});
}

function hideClickedItem(viewer) {
    console.log(scene);
    
	const result = viewer.context.castRayIfc();
    console.log(result);
	if (!result) return;
	const manager = viewer.IFC.loader.ifcManager;
    console.log(manager);
	const id = manager.getExpressId(result.object.geometry, result.faceIndex);
    console.log(id);
	viewer.IFC.loader.ifcManager.removeFromSubset(
		0,
		[id],
	);
}


// Action buttons collection
const allActionButtons = [];
console.log(allActionButtons);

// Selection button
const selectButton = document.getElementById("select-button");
allActionButtons.push(selectButton);

let selectionActive = false;
let propertiesMenu;
selectButton.onclick = () => {
    if (selectionActive) {
        selectionActive = !selectionActive;
        selectButton.classList.remove("active");
        window.onmousemove = () => {
            viewer.IFC.selector.unPrepickIfcItems();
        };
        viewer.IFC.selector.unHighlightIfcItems();
        removeAllChildren(propsGUI);
        propertiesMenu.classList.remove("visible");
    } else {
        selectionActive = !selectionActive;
        selectButton.classList.add("active");
        selectionActive = window.onmousemove = () => {
            viewer.IFC.selector.prePickIfcItem();
        };
        propertiesMenu = document.getElementById("ifc-property-menu");
        propertiesMenu.classList.add("visible");
    }
};

// Dimensions button
const measureButton = document.getElementById("measure-button");
allActionButtons.push(measureButton);

let measuresActive = false;
measureButton.onclick = () => {
    if (measuresActive) {
        measuresActive = !measuresActive;
        measureButton.classList.remove("active");
        viewer.dimensions.deleteAll();
        viewer.dimensions.previewActive = measuresActive;
    } else {
        measuresActive = !measuresActive;
        measureButton.classList.add("active");
        viewer.dimensions.active = measuresActive;
        viewer.dimensions.previewActive = measuresActive;
    }
};

// Cutting button
const cutButton = document.getElementById("cut-button");
allActionButtons.push(cutButton);

let cuttingPlansActive = false;
cutButton.onclick = () => {
    if (cuttingPlansActive) {
        cuttingPlansActive = !cuttingPlansActive;
        cutButton.classList.remove("active");
        viewer.clipper.deleteAllPlanes();
    } else {
        cuttingPlansActive = !cuttingPlansActive;
        cutButton.classList.add("active");
        viewer.clipper.active = cuttingPlansActive;
    }
};

// Hide button
// ColorCheck
const hideButton = document.getElementById("hide-button");
const checkBoxes = document.getElementById("checkboxes");
allActionButtons.push(hideButton);
const hideButtonColor = document.getElementById("color-element");
const checkBoxesColor = document.getElementById("checkboxesColor");
allActionButtons.push(hideButtonColor);

let hidingActive = false;
let hidingActiveColor = false;
hideButton.onclick = async () => {
    if (hidingActive) {
        
        hidingActive = !hidingActive;
        hideButton.classList.remove("active");
        checkBoxes.classList.remove("visible");
       // togglePickable(model, true);
        await setupAllCategories();
        const elementsWithIfcId = document.querySelectorAll(`[id^="IFC"]`);
        for (let i = 0; i < elementsWithIfcId.length; i++) {
            elementsWithIfcId[i].checked = true;
        }
        updatePostproduction();
        console.log("Vuelvo a hacerlas visibles");
    } else {
     
        hidingActive = !hidingActive;
        hideButton.classList.add("active");
        checkBoxes.classList.add("visible");
    }
    if (hidingActiveColor) {
      
        hidingActiveColor = !hidingActiveColor;
        hideButtonColor.classList.remove("active");
        checkBoxesColor.classList.remove("visible");
        resetAllCategoriesColor();
        const elementsWithIfcId = document.querySelectorAll(`[id^="IFC"]`);
        for (let i = 0; i < elementsWithIfcId.length; i++) {
            elementsWithIfcId[i].checked = true;
        }
        updatePostproduction();
    } else {
        await setupAllCategoriesColor();
        hidingActiveColor = !hidingActiveColor;
        hideButtonColor.classList.add("active");
        checkBoxesColor.classList.add("visible");
    }
};


 //evento para ocultar elementos una vez cargado un IFC
window.ondblclick = async () => hideClickedItem(viewer);
    window.onkeydown = async (event) => {
        if (event.code === 'Escape') {
            showAllItems(viewer, allIDs);
        }
    };

// Click for all buttons
window.onclick = async () => {
    if (cuttingPlansActive) {
        viewer.clipper.createPlane();
    } else if (measuresActive) {
        viewer.dimensions.create();
    } else if (selectionActive) {
        const result = await viewer.IFC.selector.highlightIfcItem();
        if (!result) return;
        const { modelID, id } = result;
        const props = await viewer.IFC.getProperties(modelID, id, true, true);
        createPropertiesMenu(props);
    }
};

// Functions for selection
const propsGUI = document.getElementById("ifc-property-menu-root");

function createPropertiesMenu(properties) {
    //console.log(properties);

    removeAllChildren(propsGUI);

    delete properties.psets;
    delete properties.mats;
    delete properties.type;

    for (let key in properties) {
        createPropertyEntry(key, properties[key]);
    }
}

function createPropertyEntry(key, value) {
    const propContainer = document.createElement("div");
    propContainer.classList.add("ifc-property-item");

    if (value === null || value === undefined) value = "-----------";
    else if (value.value) value = value.value;

    const keyElement = document.createElement("div");
    keyElement.textContent = key;
    propContainer.appendChild(keyElement);

    const valueElement = document.createElement("div");
    valueElement.classList.add("ifc-property-value");
    valueElement.textContent = value;
    propContainer.appendChild(valueElement);

    propsGUI.appendChild(propContainer);
}

function removeAllChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

// Functions for checkboxes
const categories = {
    IFCWALL,
    IFCSLAB,
    IFCBEAM,
    IFCCOLUMN,
    IFCBUILDINGELEMENTPROXY,
};
const categoriesColor = {
    IFCWALLcolor: new Color(0, 0, 1),
    IFCSLABcolor: new Color(1, 0, 1),
    IFCBEAMcolor: new Color(0, 1, 1),
    IFCCOLUMNcolor: new Color(0, 1, 0),
    IFCBUILDINGELEMENTPROXYcolor: new Color("rgb(178, 178, 178)"),
};

function getName(category) {
    const names = Object.keys(categories);
    return names.find((name) => categories[name] === category);
}
function getColor(category) {
    const names = Object.keys(categoriesColor);
    return categoriesColor[
        names.find((name) => name === getName(category) + "color")
    ];
}
function getNameColor(category) {
    const names = Object.keys(categoriesColor);
    return names.find((name) => name === getName(category) + "color");
}
async function getAll(category) {
    return viewer.IFC.loader.ifcManager.getAllItemsOfType(
        model.modelID,
        category
    );
}

//almacena subconjuntos creados
const subsets = {};

async function setupAllCategories() {
    const allCategories = Object.values(categories);
    for (const category of allCategories) {
        await setupCategory(category);
    }
}

async function setupAllCategoriesColor() {
    const allCategories = Object.values(categories);
    for (const category of allCategories) {
        setupCheckboxColor(category);
    }
}

async function setupCategory(category) {
    const subset = await newSubsetOfType(category);
    subset.userData.category = category.toString();
    subsets[category] = subset;
    //(subset, true);
    setupCheckbox(category);
}


function setupCheckbox(category) {
    const name = getName(category);
    const checkbox = document.getElementById(name);
    checkbox.addEventListener("change", () => {
    const subset = subsets[category];
        if (checkbox.checked) {
            scene.add(subset);
            togglePickable(subset, true);
        } else {
            subset.removeFromParent();
            togglePickable(subset, false);
        }
        updatePostproduction();
    });
}

function setupCheckboxColor(category) {
    const name = getNameColor(category);
    const color = getColor(category);
    const subset = subsets[category];
    //console.log(subset);
    subset.material.color = color;
    const checkboxColor = document.getElementById(name);
    checkboxColor.addEventListener("change", () => {
        const subset = subsets[category];
        if (checkboxColor.checked) {
            subset.material.color = color;
            // scene.add(subset);
        } else {
             subset.material.color = new Color(0.7, 0.7, 0.7);
             subset.removeFromParent();
        }
        updatePostproductionColor();
    });
}
function resetAllCategoriesColor() {
    for (let subset of Object.values(subsets)) {
        subset.material.color = new Color(0.7, 0.7, 0.7);
    }
}
function updatePostproduction() {
    viewer.context.renderer.postProduction.update();
}

function updatePostproductionColor() {
    viewer.context.renderer.postProduction.update();
}

async function newSubsetOfType(category) {
    const subsetMaterial = new  MeshStandardMaterial({
        color: new Color("rgb(196, 196, 196)"),     
    });
    const ids = await getAll(category);
    return viewer.IFC.loader.ifcManager.createSubset({
        modelID: model.modelID,
        scene,
        ids,
       // removePrevious: true,
        material: subsetMaterial,
       // customID: category.toString(),
    });
}


// añade o elimina subconjunto al array pickableModels
function togglePickable(mesh, isPickable) {
    const pickableModels = viewer.context.items.pickableIfcModels;
    if (isPickable) {
        pickableModels.push(mesh); 
    } else {
        const index = pickableModels.indexOf(mesh);
        pickableModels.splice(index, 1);
        pickableModels.remove;
    }
}
  

// Functions for floorplans
const dummySubsetMaterial = new MeshBasicMaterial({ visible: false });
async function exportDXF(storey, plan, modelID) {
    if (!viewer.dxf.drawings[plan.name]) {
        viewer.dxf.newDrawing(plan.name);
    }

    const ids = storey.children.map((item) => item.expressID);
    if (!ids) return;

    const subset = viewer.IFC.loader.ifcManager.createSubset({
        modelID,
        ids,
        removePrevious: true,
        customID: "floor_plan_generation",
        material: dummySubsetMaterial,
    });

    const filteredPoints = [];
    const edges = await viewer.edgesProjector.projectEdges(subset);
    const positions = edges.geometry.attributes.position.array;

    const tolerance = 0.001;
    for (let i = 0; i < positions.length - 5; i += 6) {
        const a = positions[i] - positions[i + 3];
        const b = -positions[i + 2] + positions[i + 5];

        const distance = Math.sqrt(a * a + b * b);

        if (distance > tolerance) {
            filteredPoints.push([
                positions[i],
                -positions[i + 2],
                positions[i + 3],
                -positions[i + 5],
            ]);
        }
    }

    viewer.dxf.drawEdges(
        plan.name,
        filteredPoints,
        "Projection",
        Drawing.ACI.BLUE,
        "CONTINOUS"
    );
    edges.geometry.dispose();

    viewer.dxf.drawNamedLayer(
        plan.name,
        plan,
        "thick",
        "Section",
        Drawing.ACI.RED,
        "CONTINOUS"
    );
    viewer.dxf.drawNamedLayer(
        plan.name,
        plan,
        "thin",
        "Section",
        Drawing.ACI.RED,
        "CONTINOUS"
    );

    const result = viewer.dxf.exportDXF(plan.name);
    const link = document.createElement("a");
    link.download = "floorplan.dxf";
    link.href = URL.createObjectURL(result);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function toggleShadow(active) {
    const shadows = Object.values(viewer.shadowDropper.shadows);
    for (shadow of shadows) {
        shadow.root.visible = active;
    }
}


function setupProgressNotification(viewer) {
    const text = document.getElementById("progress-text");
    viewer.IFC.loader.ifcManager.setOnProgress((event) => {
      const percent = (event.loaded / event.total) * 100;
      const result = Math.trunc(percent);
      text.innerText = result.toString();
    });
  }


