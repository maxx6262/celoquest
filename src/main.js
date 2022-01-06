import Web3 from 'web3'
import { newKitFromWeb3 } from '@celo/contractkit'
import BigNumber from 'bignumber.js'
import CeloquestAbi from '../contract/Celoquest.abi.json'

const ERC20_DECIMALS = 18

    //Contract address on Celo Testnet Chain
const celoquestContractAddress = "0xC9031FC094e12e4aee68BF223D624a9152D59Be5"
let kit
let contract
let user
let quests = []
let contributions = []

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

        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
    } else {
        notification("⚠️ Please install the CeloExtensionWallet.")
    }
}

const getQuests  = async function() {
    const _questsLength = await contract.methods.getNbQuests().call()
    const _quests = []
    for (let i = 1 ; i < _questsLength ; i++) {
        let _quest = new Promise(async (resolve, reject) => {
            let p = await contract.methods.getQuest(i).call()
            resolve( {
                id:                     i,
                owner:                  p[0],
                content:                p[1],
                cUsdReward:             p[2],
                questTokenReward:       p[3],
                nbContributions:        p[4],
                isActive:               p[5],
            })
        })
        _quests.push(_quest)
    }
    quests = await Promise.all(_quests)
    renderQuests()
}

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

const getBalance = async function() {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    const cUSDBalance  = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
    const CQTBalance   = await contract.methods.questTokenBalanceOf(kit.defaultAccount).call()
    document.querySelector("#cUsdBalance").textContent  = cUSDBalance
    document.querySelector("#CqtBalance").textContent   = CQTBalance
}

function renderQuests() {
    document.getElementById("celoquest").innerHTML = ""
    quests.forEach((_quest) => {
        const newDiv = document.createElement("div")
        newDiv.className = "col-md-4"
        newDiv.innerHTML = questTemplate(_quest)
        document.getElementById('celoquest').appendChild(newDiv)
    })
}

function questTemplate(_quest) {
    let rep = `
    <div class="card mb-4">
      <div class="card-body text-left p-4 position-relative">
        <div class="translate-middle-y position-absolute top-0">
        ${identiconTemplate(_quest.owner)}
        </div>
        <h2 class="card-title fs-4 fw-bold mt-2">${_quest.id}</h2>
        <p class="card-text mb-4" style="min-height: 82px">
          ${_quest.content}             
        </p>
        <div class="d-grid gap-2">
        <div class="position-absolute top-0 end-0 bg-warning mt-4 px-2 py-1 rounded-start">
      </div>`
      if (_quest.isActive) {
          rep += `
          <a class="btn btn-lg btn-outline-dark contributionBtn fs-6 p-3" id=${
              _quest.id
          }>
            Contribute to get ${_quest.cUsdReward} cUSD
                and  {_quest.questTokenReward} CQT
          </a>`
      }
      rep += `
        </div>
      </div>
    </div>
    `
    return rep
}

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

function notification(_text) {
    document.querySelector(".alert").style.display = "block"
    document.querySelector("#notification").textContent = _text
}

function notificationOff() {
    document.querySelector(".alert").style.display = "None"
}

window.addEventListener('load', async () => {
    notification("⌛ Loading...")
    await connectCeloWallet()
    await getBalance()
    await getUser()
    await getQuests()
    notificationOff()
});

document.querySelector("#newQuestBtn").addEventListener("click", async(e) => {
        console.log("gege")
        const _newQuest = {
            id:             quests.length,
            owner:          kit.defaultAccount,
            title:          document.getElementById("newQuestTitle").value,
            content:        document.getElementById("newQuestContent").value,
            cUsdReward:     document.getElementById("newcUSDReward").value,
            cqtReward:      document.getElementById("newCQTReward").value,
            nbActiveDays:   1,
        }
        try {
            console.log(_newQuest)
            const result = await contract.methods
                .createQuest(_newQuest.content, _newQuest.cUsdReward, _newQuest.cqtReward, _newQuest.nbActiveDays)
                .send({ from: kit.defaultAccount})
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
        quests.push(_newQuest)
        console.log(quests)
        notification(`🎉 You successfully added "${_newQuest.title}".`)
        getBalance()
        renderQuests()
})

document
    .querySelector("#newPseudoBtn").addEventListener("click", async (e) => {
            const _newPseudo = document.getElementById("newPseudo").value
            try {
                const result = await contract.methods
                    .setPseudo(_newPseudo)
                    .send({from: kit.defaultAccount})
            } catch (error) {
                notification(`⚠️ ${error}.`)
            }
            user = _newPseudo;
            notification(`🎉You succesfully set pseudo "${user.pseudo}" for address ${kit.defaultAccount}.`)
            getUser()
    })

/**
document.querySelector("#celoquest").addEventListener("click", (e) => {
    if(e.target.className.includes("likeBtn")) {
        const index = e.target.id
        try {
            const result = contract.methods
                .likePost(index)
                .send({ from: kit.defaultAccount})
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
        posts[index].nbLikes++
        notification(`🎉 You successfully liked "${posts[index].title}".`)
        renderPosts()
    }
})

document.querySelector("#celoquest").addEventListener("click", (e) => {
    if(e.target.className.includes("buyBtn")) {
        const index = e.target.id
        try {
            const result =  contract.methods
                .buyPost(index)
                .send({from: kit.defaultAccount})
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
        notification(`🎉You succesfully buyed "${posts[index].title}".`)
        getPosts()
        renderPosts()
    }
})*/
