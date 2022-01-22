import Web3 from 'web3'
import { newKitFromWeb3 } from '@celo/contractkit'
import CeloquestAbi from '../contract/Celoquest.abi.json'

const ERC20_DECIMALS = 18

    //Contract address on Celo Testnet Chain
const celoquestContractAddress = "0xC46eD808Cd90a49f148b523b7eF51fB3ACFC0730"
let nbQuests = 0
let kit
let contract
let user = {}
let quests = []
let contributions = []
let quest = {}
let nbContribs = 0
let focusedQuestId = 0
//***********************************************************************************************

    //Connec Web3 wallet to the chain
const connectCeloWallet = async function () {
    if (window.celo) {
        notification("⚠️ Please approve this DApp to use it.")
        try {
            await window.celo.enable()
            notificationOff()

            const web3 = new Web3(window.celo)
            kit = newKitFromWeb3(web3)

            const accounts = await kit.web3.eth.getAccounts()
            kit.defaultAccount = accounts[0]

            contract = new web3.eth.Contract(CeloquestAbi, celoquestContractAddress)
            nbQuests = await contract.methods.getNbQuests().call()
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
    } else {
        notification("⚠️ Please install the CeloExtensionWallet.")
    }
}
//*****************************************************************************************************

    //User management

const getUser = async function() {
    let pseudo
    try {
        const _user = await contract.methods.readUser(kit.defaultAccount).call()
        pseudo = _user[0]
    } catch (error) {
        notification(error)
        pseudo = ""
    }
    document.querySelector("#UserBlock").innerHTML = userTemplate(kit.defaultAccount, pseudo)
}

        //Get Pseudo from address
async function getPseudo(_address) {
    let pseudo = await contract.methods.getPseudo(_address).call()
    if (pseudo.trim === "") {
        pseudo = "Click to create account"
    }
    return pseudo
}

        //Display address badge
function identiconTemplate(_address) {
    const icon = blockies
        .create({
            seed: _address,
            size: 8,
            scale: 16,
        })
        .toDataURL()
    return `
  <div class="rounded-circle overflow-hidden d-inline-block border border-white border-2 shadow-sm m-0">
    <a href="https://alfajores-blockscout.celo-testnet.org/address/${_address}/transactions"
        target="_blank">
        <img src="${icon}" width="48" alt="${_address}">
    </a>
  </div>
  `
}
        //User block template
const userTemplate = function(_address, _pseudo) {
    if (_pseudo.trim() === "") {
        _pseudo =   "Unknown address"
    }
    return `<span id="user">
            ${identiconTemplate(_address)}
            <a  class="btn rounded-pill"
                data-bs-toggle="modal"
                href="#pseudoModal">
                ${_pseudo}
            </a>
            </span>`
}
        //Balance of user Wallet
const getBalance = async function() {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    const cUSDBalance  = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
    const CQTBalance   = await contract.methods.questTokenBalanceOf(kit.defaultAccount).call()
    document.querySelector("#cUsdBalance").textContent  = cUSDBalance
    document.querySelector("#CqtBalance").textContent   = CQTBalance
}


//*******************************************************************************************
    //Quests management
/*
        //Setting current focused Quest ID
const setQuestIdOnContribModal = function (_questId) {
    console.log(_questId)
    document.querySelector('#newContribModal').querySelector("#questId").innerHTML = _questId
    focusedQuestId = _questId
    quest = quests[_questId]
}
*/
        //Get all active Quests
const getAllQuests  = async function() {
    quests = []
    const _questsLength = await contract.methods.getNbQuests().call()
    try {
        notification("Loading " + _questsLength + " stored quets")
        let _quests = []
        for (let i = 0 ; i < _questsLength ; i++) {
            let _pseudo = await contract.methods.getQuestOwnerPseudo(i).call()
            let p = await contract.methods.readQuest(i).call()
            let _quest = {
                id:                 i,
                owner:              p[0],
                pseudo:             _pseudo,
                title:              p[1],
                content:            p[2],
                cUsdReward:         p[3],
                cqtReward:          p[4],
                nbContributions:    p[5],
                isActive:           p[6],
            }
            _quests.push(_quest)
        }
        quests = _quests
        quest = quests[focusedQuestId]
        await renderQuestsList()
        notificationOff()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

        //Template to display Quest on Dasboard list
async function questTemplate(_quest) {
    let rep =
        `<div class="card mb-4">
            <div class="card-body text-left p-4 position-relative">
                <div class="translate-middle-y position-absolute top-0">
                    ${identiconTemplate(_quest.owner)}
                </div>
                <h2 class="card-title fs-4 fw-bold mt-2">${_quest.title}</h2>
                <br>
                <h3 class="card-tile fs-4 fw-bold mt-1">${_quest.pseudo}</h3>
                <p class="card-text mb-4" style="min-height: 82px">
                    ${_quest.content}             
                </p>
                <div class="d-grid gap-2">
                    <div class="position-absolute top-0 end-0 bg-warning mt-4 px-2 py-1 rounded-start">
                    </div> `
    let _hasContribute = await contract.methods.hasContribute(_quest.id, kit.defaultAccount).call()
    if (_quest.isActive && !(_hasContribute)) {
        rep +=
                   `<a class="btn btn-lg btn-outline-dark contributionBtn fs-6 p-3" 
                       data-bs-toggle="modal"
                       data-bs-target="#newContribModal"
                       onclick="setQuestIdOnContribModal(${_quest.id});"
                    > 
                        <div id="questId" style="display: none"> ${_quest.id} </div>
                            Contribute to get ${_quest.cUsdReward} cUSD
                            and ${_quest.cqtReward} CQT
                    </a>`
    }
    else {
        rep +=
                   `<button class="btn btn-lg btn-outline-dark fs-6 p-3 seeContribBtn"
                            onclick="setQuestIdOnContribModal(${quest.id});"
                    > 
                        <div id="questId" style="display: none"> ${_quest.id} </div>
                        See all contributions 
                    </button> 
                    <p>
                        Reward = <strong> ${_quest.cUsdReward} cUSD </strong>
                        and  <strong> ${_quest.cqtReward} CQT </strong>
                    </p>`
    }
    rep +=
                `</div>
             </div>
         </div>`
   return rep
}

async function storeQuest(_newQuest) {
    try {
        notification("Adding New Quest")
        await contract.methods.createQuest(
            _newQuest.title,
            _newQuest.content,
            _newQuest.cUsdReward,
            _newQuest.cqtReward
        ).send({from: _newQuest.owner})
        notification("New Quest stored on chain")
        await getBalance()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

//***********************************************************************************************
        //Contributions management

        //Vote on contrib
async function voteContrib (_contribId) {
    try {
        notification("Adding new Vote on Chain")
        const result = await contract.methods.newVote(_contribId)
            .send({from: kit.defaultAccount})
            .then(notificationOff)
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}


function contribTemplate(_contrib) {
    return `<div class="card mb4 contrib contribCard">
                <div class="card-body text-left p-4 position-relative">
                    <div class="translate-middle-y position-absolute top-0">
                        ${identiconTemplate(_contrib.owner)}    
                    </div>
                    <h2 class="card-title fs-4 fw-bold mt-2"> ${_contrib.pseudo} </h2>
                    <div id="contribId"> ${_contrib.id}</div>
                    <p class="card-text mb-4" style="min-height: 82px">
                        ${_contrib.content}             
                    </p>    
                    <div class="position-absolute top-0 end-0 bg-warning mt-4 px-2 py-1 rounded-start">
                    </div>
                    <button class=btn btn-dark voteBtn"
                           onclick='voteContrib(${_contrib.id})'
                    > 
                        Vote 
                    </button>
                                
                    <div class="btn btn-lg btn-outline-dark contributionBtn fs-6 p-3"
                        ${_contrib.nbVotes} votes
                    </div>
                </div>
            </div>`
}

const questHeaderTemplate = function (_questId) {
    try {
        if  (focusedQuestId != _questId) {
            notification('Loading Quest Header')
            loadQuest(_questId)
            notificationOff()
        }
        return (
            `<div class="class="container my-8"> 
                <br>
                <h1> Contribution's list </h1>
                <button class="btn btn-dark"
                        id="questListBtn"
                >
                    Back to Quests listing
                </button>
            
                <div class="questHeader" id="questHeader">
                    <div class="translate-middle-y position-absolute top-0">
                        ${identiconTemplate(quest.owner)}
                    </div>
                    <h2> ${quest.title} </h2>
                    <h3> ${quest.content} </h3>
                    <p>
                        List of ${quest.nbContributions} 
                    </p>
                </div>
                <br>
            </div>`)
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
}

        //Rending all contributions from QuestId
async function renderContributionsList(questId) {
    try {
        notification("Loading Quest")
        await loadQuest(questId)
        notificationOff()
    } catch (error) {
        notification(error)
    }
    document.getElementById("celoquest").innerHTML = ""
    let newHead = document.createElement("div")
    newHead.className = "col-md-12 questHeader"
    newHead.innerHTML = await questHeaderTemplate(questId)
    document.getElementById("celoquest").appendChild(newHead)

    let nbContribQuest = 0
    try {
        nbContribQuest = await contract.methods.getQuestNbContribs(questId).call()
        notification('Loading ' + nbContribQuest + ' contributions')
        for (let j = 0; j < nbContribQuest; j++) {
            try {
                let _contributionId = await contract.methods.getContribId(questId, j).call()
                const _contribRep   = await contract.methods.readContribution(_contributionId).call()
                let _contribPseudo  = await getPseudo(_contribRep[1])
                let _contrib = {
                    id: _contributionId,
                    owner: _contribRep[1],
                    pseudo: _contribPseudo,
                    title: _contribRep[2],
                    content: _contribRep[3],
                    nbVotes: _contribRep[4],
                }
                const newDiv = document.createElement("div")
                newDiv.className = "col-md-4 contribBlock"
                newDiv.innerHTML = contribTemplate(_contrib)
                document.getElementById('celoquest').appendChild(newDiv)
                notificationOff()
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
        }
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

//*******************************************************************************************************/
const loadQuest = async function (_questId) {
    try {
        let _questOwnerPseudo = await contract.methods.getQuestOwnerPseudo(_questId).call()
        const rep = await contract.methods.readQuest(_questId).call()
        let _quest = {
            id:         _questId,
            owner:      rep[0],
            pseudo:     _questOwnerPseudo,
            title:      rep[1],
            content:    rep[2],
            nbContribs: rep[5],
            contribs:   [],
            isActive:   rep[6],
        }
        if (_quest.isActive) {
            contributions   =   []
            for (let i = 0 ; i < _quest.nbContribs ; i++) {
                try {
                    const _contribId = await contract.methods.getContribId(_questId, i).call()
                    const contribRep = await contract.methods.readContribution(_contribId).call()
                    let _contribOwner    =   contribRep[1]
                    let _contribPseudo   =   getPseudo(_contribOwner)
                    let _contrib = {
                        id:             _contribId,
                        owner:          _contribOwner,
                        pseudo:         _contribPseudo,
                        title:          contribRep[2],
                        content:        contribRep[3],
                        nbVotes:        contribRep[4],
                    }
                    _quest.contribs.push(_contrib)
                    contributions.push(_contrib)
                    quest = _quest
                    notificationOff()
                } catch (error) {
                    notification(`⚠️ ${error}.`)
                }
            }
        }
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

async function renderQuestsList() {
    document.getElementById("celoquest").innerHTML = ""
    for (const _quest of quests) {
        const newDiv = document.createElement("div")
        newDiv.className = "col-md-4"
        newDiv.innerHTML =  await questTemplate(_quest)
        document.getElementById('celoquest').appendChild(newDiv)
    }
}

//***********************************************************************************************

        //Notifications management
function notification(_text) {
    document.querySelector(".alert").style.display = "block"
    document.querySelector("#notification").textContent = _text
}

function notificationOff() {
    document.querySelector(".alert").style.display = "None"
}

//********************************************************************************************

        //Event listeners
window.addEventListener('load', async () => {
    notification("⌛ Loading...")
    await connectCeloWallet()
    await getBalance()
    await getUser()
    await getAllQuests()
    notificationOff()
});

        //New Quest Creation Event
document.querySelector("#newQuestBtn").addEventListener("click", async(e) => {
        try  { const _newQuest = {
            id:             nbQuests,
            owner:          kit.defaultAccount,
            title:          document.getElementById('newQuestTitle').value,
            content:        document.getElementById('newQuestContent').value,
            cUsdReward:     document.getElementById('newcUSDReward').value,
            cqtReward:      document.getElementById('newCQTReward').value
            }
            await storeQuest(_newQuest)
            notification("Quest recorded on Chain !")
            await getAllQuests()
            await renderQuestsList()
            notificationOff()
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
})


        //New Contrib Event
document.querySelector("#newContribBtn").addEventListener("click", async (e) => {
    try {
        const _newContrib = {
            id:             nbContribs,
            owner:          kit.defaultAccount,
            questId:        document.querySelector('#newContribModal').querySelector('#questId').textContent,
            title:          document.getElementById('newContributionTitle').value,
            content:        document.getElementById('newContributionContent').value,
            nbVotes:        0,
        }
        const result = await contract.methods.createContribution(_newContrib.questId, _newContrib.title, _newContrib.content)
            .send({ from: kit.defaultAccount})
        renderContributionsList(_newContrib.questId)
            notificationOff()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
})

//See all contributions from Quest
let contribsBtnList = document.getElementsByClassName("seeContribBtn")
contribsBtnList.forEach(_contribBtn => {
    _contribBtn.addEventListener('click', async (e) => {
        try {
            notification("Loading contributions");
            renderContributionsList(questId)
            notificationOff()
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
    })
})


//Set Pseudo : when user click on pseudo on user block
document
    .querySelector("#newPseudoBtn").addEventListener("click", async (e) => {
            const _newPseudo = document.getElementById("newPseudo").value
            try {
                const result = await contract.methods
                    .setPseudo(_newPseudo)
                    .send({from: kit.defaultAccount})
                    user = _newPseudo;
                    notification(`🎉You succesfully set pseudo "${user}" for address ${kit.defaultAccount}.`)
                    await getUser()
                    await getBalance()
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
})

//Add return to Quest List event
document.querySelector('#questListBtn').addEventListener('click', async (e) => {
    try {
        notification("Return to Quest List")
        document.getElementById('celoquest').innerHTML = ""
        await renderQuestsList()
        notificationOff()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
})

