import Web3 from 'web3'
import newKitFromWeb3 from '@celo/contractkit'
import BigNumber from 'bignumber.js'
import CeloquestAbi from '../contract/Celoquest.abi.json'

const ERC20_DECIMALS = 18

    //Contract address on Celo Testnet Chain
const CeloQuestContractAddress = "0x41fC4138799be4Fec40E6ae8D8e92268c562d1c8" +
    ""
let kit
let contract
let user
let posts = []

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

            contract = new web3.eth.Contract(CelobookAbi, CelobookContractAddress)

        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
    } else {
        notification("⚠️ Please install the CeloExtensionWallet.")
    }
}

const getPosts   = async  function() {
    const _postsLength = await contract.methods.getNbPosts().call()
    const _posts = []
    for (let i = 0 ; i < _postsLength ; i++) {
        let _post = new Promise(async  (resolve, reject) => {
            let p = await contract.methods.getPost(i).call()
            resolve({
                id:         i,
                title:      p[0],
                content:    p[1],
                nbLikes:    p[2],
                price:      p[3],
                owner:      p[4],
            })
        })
        _posts.push(_post)
    }
    posts = await Promise.all(_posts)
    renderPosts()
}

const getUser = async function() {
    let _user = new Promise(async (resolve, reject) => {
        let p = await contract.methods.readUser(kit.defaultAccount).call()
        resolve({
            address: kit.defaultAccount,
            pseudo: p[0],
            nbPosts: p[1],
            nbLikes: p[2],
            canLike: p[3],
            CBTBalance: p[4],
        })
    })
    user = await Promise.all(_user)
}



const getBalance = async function() {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    //const cUSDBalance = 10;//totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
    const likeBalance = await contract.methods.getLikeBalance(kit.defaultAccount).call()
    document.querySelector("#balance").textContent = likeBalance / (10 ** 18)
}

function renderPosts() {
    document.getElementById("celoquest").innerHTML = ""
    posts.forEach((_post) => {
        const newDiv = document.createElement("div")
        newDiv.className = "col-md-4"
        newDiv.innerHTML = postTemplate(_post)
        document.getElementById("celoquest").appendChild(newDiv)
    })
}

function postTemplate(_post) {
    let rep = `
    <div class="card mb-4">
      <div class="card-body text-left p-4 position-relative">
        <div class="translate-middle-y position-absolute top-0">
        ${identiconTemplate(_post.owner)}
        </div>
        <h2 class="card-title fs-4 fw-bold mt-2">${_post.title}</h2>
        <p class="card-text mb-4" style="min-height: 82px">
          ${_post.content}             
        </p>
        <div class="d-grid gap-2">
        <div class="position-absolute top-0 end-0 bg-warning mt-4 px-2 py-1 rounded-start">
        <button
            type="button"
            class="likeBtn"
            id=${_post.id}>
        ${_post.nbLikes} Likes
        </button>
      </div>`
      if (_post.price > 0) {
          rep += `
          <a class="btn btn-lg btn-outline-dark buyBtn fs-6 p-3" id=${
              _post.id
          }>
            Buy for ${_post.price} cUSD
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
    notificationOff()
});

document
    .querySelector("#newPostBtn")
    .addEventListener("click", () => {
        const _newPost = {
            id:             posts.length,
            owner:          "0x2EF48F32eB0AEB90778A2170a0558A941b72BFFb",
            title:          document.getElementById("newPostTitle").value,
            author:         document.getElementById('newPostAuthor').value,
            content:        document.getElementById("newPostContent").value,
            price:          document.getElementById("newPrice").value,
            nbLikes:        0,
        }
        try {
            const result = contract.methods
                .newPost(_newPost.title, _newPost.content)
                .send({ from: kit.defaultAccount})
        } catch (error) {
            notification(`⚠️ ${error}.`)
        }
        posts.push(_newPost)
        notification(`🎉 You successfully added "${_newPost.title}".`)
        renderPosts()
    })

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
})

getUser
getPosts