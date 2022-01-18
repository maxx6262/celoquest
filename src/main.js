import Web3 from 'web3'
import { newKitFromWeb3 } from '@celo/contractkit'
import BigNumber from 'bignumber.js'
import CeloquestAbi from '../contract/Celoquest.abi.json'

const ERC20_DECIMALS = 18

    //Contract address on Celo Testnet Chain
const celoquestContractAddress = "0x0d796Ac63f41d48c3592b5f6eE73A673E9D6Fa53"
let nbQuests
let kit
let contract
let user
let focusedQuest
let focusedContrib
let quests = []
let contributions = []

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
        pseudo = "Unknown user"
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
const getActiveQuests  = async function() {
    quests = []
    const _questsLength = await contract.methods.getNbQuests().call()
    notification("Loading " + _questsLength + " stored quets")
    let _quests = []
    for (let i = 0 ; i < _questsLength ; i++) {
        let p = await contract.methods.getActiveQuest(i).call()
        let _pseudo = await contract.methods.getQuestOwnerPseudo(i).call()
        let _quest = {
            id:                 i,
            owner:              p[0],
            pseudo:             _pseudo,
            title:              p[1],
            content:            p[2],
            cUsdReward:         p[3],
            cqtReward:          p[4],
            nbContributions:    p[5],
        }
        _quests.push(_quest)
        }
    quests = _quests
    renderQuestsList()
    notificationOff()
}

function renderQuestsList() {
    document.getElementById("celoquest").innerHTML = ""
    quests.forEach((_quest) => {
        const newDiv = document.createElement("div")
        newDiv.className = "col-md-4"
        newDiv.innerHTML = questTemplate(_quest)
        document.getElementById('celoquest').appendChild(newDiv)
    })
}
        //Template to display Quest on Dasboard list
function questTemplate(_quest) {
    return `
    <div class="card mb-4">
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
        </div>
        <a class="btn btn-lg btn-outline-dark contributionBtn fs-6 p-3" 
           data-bs-toggle="modal"
           data-bs-target="#newContribModal 
           "id="${_quest.id}">
            Contribute to get ${_quest.cUsdReward} cUSD
                and  ${_quest.cqtReward} CQT
        </a>
       </div>
      </div>
    </div>`
}

async function storeQuest(_newQuest) {
    try {
        notification("Adding New Quest")
        await contract.methods.createQuest(
            _newQuest.title,
            _newQuest.content,
            _newQuest.cUsdReward,
            _newQuest.cqtReward,
            _newQuest.nbActiveDays
        ).send({from: _newQuest.owner})
        notificationOff()
    } catch (error) {
        notification(error)
    }
}


async function addQuest(_title, _content, _cUsdReward, _cqtReward, _nbActiveDays) {
    try {
        const _newQuest = {
            id:             quests.length,
            owner:          kit.defaultAccount,
            title:          _title,
            content:        _content,
            cUsdReward:     _cUsdReward,
            cqtReward:      _cqtReward,
            nbActiveDays:   _nbActiveDays
        }
        const result = await contract.methods
            .createQuest(_title, _content, _cUsdReward, _cqtReward, _nbActiveDays)
            .send({from: kit.defaultAccount})
        notification(`🎉 You successfully added "${_newQuest.title}".`)
        quests.push(_newQuest)
        getBalance()
        renderQuestsList()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

//***********************************************************************************************
        //Contributions management
/*
async function getContrib(_contribId) {
    const result    = await contract.methods.readContribution(_contribId).call()
    let _pseudo     = getPseudo(result[1])
    const contrib   = {
        id:         _contribId,
        owner:      result[1],
        pseudo:     _pseudo,
        content:    result[3],
        nbVotes:    result[4],
    }
    return contrib
}
*/

function contribTemplate(_contrib) {
    return `<div class="card mb4 contrib">
            <div class="card-body text-left p-4 position-relative">
                <div class="translate-middle-y position-absolute top-0">
                    $(identiconTemplate(_contrib.owner)}    
                </div>
                <h2 class="card-title fs-4 fw-bold mt-2"> ${_contrib.pseudo} </h2>
                <p class="card-text mb-4" style="min-height: 82px">
                    ${_contrib.content}             
                </p>    
                <div class="position-absolute top-0 end-0 bg-warning mt-4 px-2 py-1 rounded-start">
                </div>
                <a class="btn btn-lg btn-outline-dark contributionBtn fs-6 p-3">
                    ${_contrib.nbVotes} votes
                </a>
            </div>
            </div>
        `
}

async function loadContribs(_questId) {
    const resultQuest = await contract.methods.getQuest(_questId).call()
    const QuestPseudo = getPseudo(resultQuest[0])
    const Quest = {
        id:             _questId,
        owner:          resultQuest[0],
        pseudo:         QuestPseudo,
        title:          resultQuest[1],
        content:        resultQuest[2],
        nbContribs:     resultQuest[3],
        isActive:       resultQuest[4],
    }
    quests = [Quest]
    let _contribs = []
    for (let i = 0 ; i < Quest.nbContribs ; i++) {
        let _contrib  =   new Promise( async (resolve, reject)  => {
            let _contribId = await contract.methods.getContribId(_questId, i)
            let p          = await contract.methods.readContribution(_contribId)
            resolve({
                contribId: p[0],
                questId: _questId,
                owner: p[1],
                pseudo: getPseudo(p[1]),
                content: p[2],
                nbVotes: p[3],
            })
        })
        _contribs.push(_contrib)
    }
    contributions = await Promise.all(_contribs)
}

function renderContributionsList() {
    document.getElementById("celoquest").innerHTML =
        questHeaderTemplate(quests[0])
    loadContribs(quests[0].id)
    contributions.forEach((_contribution) => {
        const newDiv = document.createElement("div")
        newDiv.className = "col-md-4"
        newDiv.innerHTML = contribTemplate(_contribution)
        document.getElementById('celoquest').appendChild(newDiv)
    })
}

function questHeaderTemplate(_quest) {
    return ` <div class="header" id="questHeader">
            ${identiconTemplate(_quest.owner)}
            <h1> ${_quest.title} </h1>
            <p> ${_quest.content} </p>
            </div>`
}

async function addContribution(_questId, _title, _content) {
    try {
        notification("Adding contribution")
        await contract.methods.createContribution(_questId, _title, _content);
        notificationOff()
    } catch (error) {
        notification(error)
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
    await getActiveQuests()
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
            cqtReward:      document.getElementById('newCQTReward').value,
            nbActiveDays:   7,
            }
        storeQuest(_newQuest)
        } catch (error) {
            console.log(error)
        }
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
                    notification(`🎉You succesfully set pseudo "${user.pseudo}" for address ${kit.defaultAccount}.`)

            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
            getUser()
            getActiveQuests()
    })

//*******************************************************************************************************/
async function loadQuest(_questId) {
    try {
        const rep = await contract.methods.getQuest(_questId).call()
        try {
            let _owner = rep[0]
            const ownerUserRep = await contract.methods.readUser(_owner).call()
            let _user = {
                owner:          _owner,
                pseudo:         ownerUserRep[0],
                nbQuests:       ownerUserRep[1],
                nbContribs:     ownerUserRep[2],
                cqtBalance:     ownerUserRep[3],
                cUsdBalance:    ownerUserRep[4],
            }
            let _quest = {
                id:         _questId,
                owner:      _user,
                title:      rep[1],
                content:    rep[2],
                nbContribs: rep[3],
                contribs:   [],
                isActive:   rep[4],
            }
            if (_quest.isActive) {
                for (let i = 0 ; i < _quest.nbContribs ; i++) {
                    try {
                        const _contribId = await contract.methods.getContribId(_questId, i).call()
                        try {
                            const contribRep = await contract.methods.readContribution(_contribId).call()
                            try {
                                let contribOwner    =   contribRep[1]
                                const _contribOwnerUser = await contract.methods.readUser(contribRep).call()
                                let _contribUser = {
                                    owner:          contribOwner,
                                    pseudo:         _contribOwnerUser[0],
                                    nbQuests:       _contribOwnerUser[1],
                                    nbContribs:     _contribOwnerUser[2],
                                    cqtBalance:     _contribOwnerUser[3],
                                    cUsdBalance:    _contribOwnerUser[4],
                                }
                                let _contrib = {
                                    id:             _contribId,
                                    owner:          _contribUser,
                                    title:          contribRep[2],
                                    content:        contribRep[3],
                                    nbVotes:        contribRep[4],
                                }
                                _quest.contribs.push(_contrib)
                                focusedQuest = _quest
                            } catch (error) {
                                notification(`⚠️ ${error}.`)
                            }
                        } catch (error) {
                            notification(`⚠️ ${error}.`)
                        }
                    } catch (error) {
                        notification(`⚠️ ${error}.`)
                    }
                }
            }
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
    }  catch (error) {
        notification(`⚠️ ${error}.`)
    }
}