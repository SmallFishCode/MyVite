<template>
    <div>
        <h1>大家好</h1>
        <h2>小鱼早日上岸！！</h2>
        <span>count is {{count}}</span>
        <button @click="add">Add</button>
    </div>
</template>

<script>
import {ref} from 'vue'

export default {
    setup() {
        const count = ref(0)
        
        const add = () => {
            count.value++
        }

        return {
            count,
            add
        }
    },
}
</script>