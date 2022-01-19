import Web3 from 'web3'
import { newKitFromWeb3 } from '@celo/contractkit'
import BigNumber from 'bignumber.js'
import CeloquestAbi from '../contract/Celoquest.abi.json'

const ERC20_DECIMALS = 18

    //Contract address on Celo Testnet Chain
const celoquestContractAddress = "0xC86625dFbA7277Bb3CB4d8c507E939953FA70D89"
let nbQuests
let kit
let contract
let user
let quests = []
let contributions = []
let quest = {}
let nbContribs = 0
let focusedQuestId
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

        //Setting current focused Quest ID
const setQuestIdOnContribModal = function(_questId) {
    focusedQuestId = _questId
    quest = quests[_questId]
}

        //Get all active Quests
const getAllQuests  = async function() {
    quests = []
    nbContribs = await contract.methods.getNbContributions().call()
    const _questsLength = await contract.methods.getNbQuests().call()
    try {
        notification("Loading " + _questsLength + " stored quets")
        let _quests = []
        for (let i = 0 ; i < _questsLength ; i++) {
            let _owner = await contract.methods.getQuestOwner(i).call()
            let _pseudo = await contract.methods.getQuestOwnerPseudo(i).call()
            let p = await contract.methods.getActiveQuest(i).call()
            let _quest = {
                id:                 i,
                owner:              _owner,
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
        focusedQuestId =  0
        quest = quests[focusedQuestId]
        await renderQuestsList()
        notificationOff()
    } catch (error) {
    notification(error)
    }
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
           data-bs-target="#newContribModal"
           onclick=setQuestIdOnContribModal
           
           (${_quest.id})>
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
        await renderQuestsList()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

//***********************************************************************************************
        //Contributions management

async function getContrib(_contribId) {
    const result    = await contract.methods.readContribution(_contribId).call()
    let _pseudo     = await getPseudo(result[1])
    const contrib   = {
        id:         _contribId,
        owner:      result[1],
        pseudo:     _pseudo,
        title:      result[2],
        content:    result[3],
        nbVotes:    result[4],
    }
    return contrib
}

function contribTemplate(_contrib) {
    return `<div class="card mb4 contrib">
            <div class="card-body text-left p-4 position-relative">
                <div class="translate-middle-y position-absolute top-0">
                    ${identiconTemplate(_contrib.owner)}    
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

function questHeaderTemplate(_quest) {
    try {
        notification('Loading Quest Header')
        loadQuest(_quest.id)
        _quest = quest
        notificationOff()
    } catch (error) {
        notification(error)
    }
    return ` <br>
            <h1> Contribution's list </h1>
             <div class="header" id="questHeader">
            ${identiconTemplate(_quest.owner)}
            <h2> ${_quest.title} </h2>
            <h3> ${_quest.content} </h3>
            </div>
`
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
    newHead.innerHTML = questHeaderTemplate(quests[questId])
    document.getElementById("celoquest").appendChild(newHead)

    let nbContribQuest = 0
    try {
        nbContribQuest = await contract.methods.getQuestNbContribs(questId).call()
        notification('Loading ' + nbContribQuest + ' contributions')
        for (let j = 0; j < nbContribQuest; j++) {
            try {
                let _contributionId = await contract.methods.getContribId(questId, j).call()
                const _contribRep = await contract.methods.readContribution(_contributionId).call()
                let _contribPseudo = await getPseudo(_contribRep[1])
                let _contrib = {
                    id: _contributionId,
                    owner: _contribRep[1],
                    pseudo: _contribPseudo,
                    title: _contribRep[2],
                    content: _contribRep[3],
                    nbVotes: _contribRep[4],
                }
                const newDiv = document.createElement("div")
                newDiv.className = "col-md-4"
                newDiv.innerHTML = contribTemplate(_contrib)
                document.getElementById('celoquest').appendChild(newDiv)
                notificationOff()
            } catch (error) {
                notification(error)
            }
        }
    } catch (error) {
        notification(error)
    }
}

//*******************************************************************************************************/
async function loadQuest(_questId) {
    try {
        const rep = await contract.methods.getQuest(_questId).call()
        try {
            let _quest = {
                id:         _questId,
                owner:      rep[0],
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
                        const contribRep = await contract.methods.readContribution(_contribId).call()
                        let _contribOwner    =   contribRep[1]
                        let _contrib = {
                            id:             _contribId,
                            owner:          _contribOwner,
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
    }  catch (error) {
        notification(`⚠️ ${error}.`)
    }
}

async function renderQuestsList() {
    document.getElementById("celoquest").innerHTML = ""
    for (const _quest of quests) {
        const newDiv = document.createElement("div")
        newDiv.className = "col-md-4"
        newDiv.innerHTML = questTemplate(_quest)
        document.getElementById('celoquest').appendChild(newDiv)
    }
}


        //Adding contribution at Quest
async function addContribution(_questId, _title, _content) {
    try {
        notification("Adding contribution")
        await contract.methods.createContribution(_questId, _title, _content)
            .send({ from: kit.defaultAccount });
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
            cqtReward:      document.getElementById('newCQTReward').value,
            nbActiveDays:   7,
            }
        storeQuest(_newQuest)
        } catch (error) {
            console.log(error)
        }
})


        //New Contrib Event
document.querySelector("#newContribBtn").addEventListener("click", async () => {
    try {
        const _newContrib = {
            id:             nbContribs,
            owner:          kit.defaultAccount,
            questId:        focusedQuestId,
            title:          document.getElementById('newContributionTitle').value,
            content:        document.getElementById('newContributionContent').value,
        }
        await addContribution(_newContrib.questId, _newContrib.title, _newContrib.content)
        renderContributionsList(focusedQuestId)
    } catch (error) {
        notification(error)
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
            getAllQuests()
    })
